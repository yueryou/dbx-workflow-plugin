pub mod context;

use std::thread;

use dbx_plugin_sdk::{PluginEmitter, PluginError};
use serde_json::{json, Value};

use crate::engine::context::WorkflowContext;
use crate::store::{ExecutionRepository, FileStore, WorkflowRepository};

/// 工作流执行引擎
pub struct WorkflowEngine {
    store: FileStore,
    emitter: PluginEmitter,
    workflows: WorkflowRepository,
    executions: ExecutionRepository,
}

impl WorkflowEngine {
    pub fn new(store: FileStore, emitter: PluginEmitter) -> Self {
        let workflows = WorkflowRepository::new(store.clone());
        let executions = ExecutionRepository::new(store.clone());
        Self {
            store,
            emitter,
            workflows,
            executions,
        }
    }

    /// 执行工作流 - 在新线程中运行
    pub fn run(&self, workflow_id: String) -> Result<String, PluginError> {
        let execution_id = self.create_execution_record(&workflow_id)?;
        let emitter = self.emitter.clone();
        let store = self.store.clone();
        let exec_id = execution_id.clone();
        let wf_id = workflow_id.clone();

        thread::spawn(move || {
            let engine = WorkflowEngine::new(store, emitter);
            if let Err(e) = engine.execute_workflow(&wf_id, &exec_id) {
                eprintln!("[WorkflowEngine] Execution failed: {}", e.message);
            }
        });

        Ok(execution_id)
    }

    /// 核心执行逻辑
    fn execute_workflow(
        &self,
        workflow_id: &str,
        execution_id: &str,
    ) -> Result<(), PluginError> {
        // 1. 更新状态为 running
        self.executions.update_status(
            execution_id,
            crate::models::execution::ExecutionStatus::Running,
            None,
        )?;

        // 2. 发送开始事件
        self.emit("execution/started", json!({
            "executionId": execution_id,
            "workflowId": workflow_id,
        }))?;

        // 3. 加载工作流
        let workflow = match self.workflows.get_value(workflow_id) {
            Ok(wf) => wf,
            Err(e) => {
                self.emit("execution/failed", json!({
                    "executionId": execution_id,
                    "error": e.message.clone(),
                }))?;
                self.executions.update_status(
                    execution_id,
                    crate::models::execution::ExecutionStatus::Failed,
                    Some(0),
                )?;
                return Err(e);
            }
        };

        // 4. DAG 拓扑排序
        let execution_order = self.topological_sort(&workflow)?;

        // 5. 创建执行上下文
        let mut ctx = WorkflowContext::new(
            workflow_id.to_string(),
            execution_id.to_string(),
        );

        // 记录开始时间
        let start_time = std::time::Instant::now();

        // 6. 按顺序执行节点
        let nodes = workflow.get("nodes").and_then(|n| n.as_array());
        if let Some(nodes) = nodes {
            for node_id in &execution_order {
                // 查找节点定义
                let node = match nodes.iter().find(|n| {
                    n.get("id").and_then(|id| id.as_str()) == Some(node_id.as_str())
                }) {
                    Some(n) => n.clone(),
                    None => continue, // 跳过不存在的节点（如 Start/End 虚拟节点）
                };

                let node_name = node
                    .get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or(node_id)
                    .to_string();

                // 发送节点开始事件
                self.emit("execution/nodeStarted", json!({
                    "executionId": execution_id,
                    "nodeId": node_id,
                    "nodeName": node_name,
                }))?;

                // 记录节点开始时间
                let node_start = std::time::Instant::now();

                // 执行节点
                match self.execute_node(&node, &mut ctx) {
                    Ok(output) => {
                        ctx.set_node_output(node_id, output.clone());
                        let node_duration = node_start.elapsed().as_millis() as i64;

                        // 持久化节点结果
                        let node_result = json!({
                            "node_id": node_id,
                            "status": "completed",
                            "started_at": crate::util::now_iso(),
                            "finished_at": crate::util::now_iso(),
                            "duration_ms": node_duration,
                            "output": output,
                            "error": null,
                            "attempts": 1,
                        });
                        let _ = self.executions.add_node_result(execution_id, node_id, &node_result);

                        self.emit("execution/nodeCompleted", json!({
                            "executionId": execution_id,
                            "nodeId": node_id,
                            "nodeName": node_name,
                            "status": "completed",
                            "output": output,
                        }))?;
                    }
                    Err(e) => {
                        let node_duration = node_start.elapsed().as_millis() as i64;

                        // 持久化失败节点结果
                        let node_result = json!({
                            "node_id": node_id,
                            "status": "failed",
                            "started_at": crate::util::now_iso(),
                            "finished_at": crate::util::now_iso(),
                            "duration_ms": node_duration,
                            "output": null,
                            "error": e.message.clone(),
                            "attempts": 1,
                        });
                        let _ = self.executions.add_node_result(execution_id, node_id, &node_result);

                        self.emit("execution/nodeFailed", json!({
                            "executionId": execution_id,
                            "nodeId": node_id,
                            "nodeName": node_name,
                            "error": e.message.clone(),
                        }))?;
                        self.emit("execution/failed", json!({
                            "executionId": execution_id,
                            "error": e.message.clone(),
                            "failedNodeId": node_id,
                        }))?;

                        // 更新执行状态为 failed
                        let _ = self.executions.update_status(
                            execution_id,
                            crate::models::execution::ExecutionStatus::Failed,
                            Some(node_duration),
                        );

                        return Err(e);
                    }
                }
            }
        }

        // 计算总耗时
        let total_duration = start_time.elapsed().as_millis() as i64;

        // 更新执行状态为 completed
        self.executions.update_status(
            execution_id,
            crate::models::execution::ExecutionStatus::Completed,
            Some(total_duration),
        )?;

        // 发送完成事件
        self.emit("execution/completed", json!({
            "executionId": execution_id,
            "status": "completed",
            "finishedAt": crate::util::now_iso(),
            "durationMs": total_duration,
        }))?;

        Ok(())
    }

    /// 执行单个节点
    fn execute_node(
        &self,
        node: &Value,
        ctx: &mut WorkflowContext,
    ) -> Result<Value, PluginError> {
        let node_type = node
            .get("node_type")
            .and_then(|t| t.as_str())
            .unwrap_or("unknown");

        match node_type {
            "file_read" => self.execute_file_read(node, ctx),
            "sql_transform" => self.execute_sql_transform(node, ctx),
            "sql_execute" => self.execute_sql_execute(node, ctx),
            "condition" => self.execute_condition(node, ctx),
            "notify" => self.execute_notify(node, ctx),
            "start" | "end" => {
                // 虚拟节点，直接跳过
                Ok(json!({"status": "skipped", "nodeType": node_type}))
            }
            _ => Err(PluginError::new(
                -32602,
                format!("Unknown node type: {}", node_type),
            )),
        }
    }

    /// 拓扑排序 (Kahn 算法)
    fn topological_sort(&self, workflow: &Value) -> Result<Vec<String>, PluginError> {
        let nodes = workflow
            .get("nodes")
            .and_then(|n| n.as_array())
            .ok_or_else(|| PluginError::new(-32602, "Missing nodes"))?;
        let empty_edges = vec![];
        let edges = workflow
            .get("edges")
            .and_then(|e| e.as_array())
            .unwrap_or(&empty_edges);

        let mut in_degree: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
        let mut adjacency: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();

        // 初始化
        for node in nodes {
            let id = node
                .get("id")
                .and_then(|id| id.as_str())
                .unwrap_or("")
                .to_string();
            in_degree.entry(id.clone()).or_insert(0);
            adjacency.entry(id.clone()).or_default();
        }

        // 构建邻接表和入度
        for edge in edges {
            let source = edge.get("source_node").and_then(|s| s.as_str()).unwrap_or("");
            let target = edge.get("target_node").and_then(|t| t.as_str()).unwrap_or("");
            if !source.is_empty() && !target.is_empty() {
                adjacency
                    .entry(source.to_string())
                    .or_default()
                    .push(target.to_string());
                *in_degree.entry(target.to_string()).or_insert(0) += 1;
            }
        }

        // Kahn 算法
        let mut queue: std::collections::VecDeque<String> = in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(id, _)| id.clone())
            .collect();

        let mut result = Vec::new();
        while let Some(node_id) = queue.pop_front() {
            result.push(node_id.clone());
            if let Some(neighbors) = adjacency.get(&node_id) {
                for neighbor in neighbors {
                    if let Some(deg) = in_degree.get_mut(neighbor) {
                        *deg -= 1;
                        if *deg == 0 {
                            queue.push_back(neighbor.clone());
                        }
                    }
                }
            }
        }

        // 检测环
        let total_nodes = nodes.len();
        if result.len() != total_nodes {
            return Err(PluginError::new(
                -32602,
                format!(
                    "Workflow contains cycles or unreachable nodes ({} of {} nodes reachable)",
                    result.len(),
                    total_nodes
                ),
            ));
        }

        Ok(result)
    }

    // === 节点执行器 ===

    fn execute_file_read(
        &self,
        node: &Value,
        ctx: &WorkflowContext,
    ) -> Result<Value, PluginError> {
        let config = node
            .get("config")
            .ok_or_else(|| PluginError::new(-32602, "Missing node config"))?;

        let path = config
            .get("path")
            .and_then(|p| p.as_str())
            .ok_or_else(|| PluginError::new(-32602, "Missing file path"))?;

        let resolved_path = ctx.resolve_template(path);
        let content = std::fs::read_to_string(&resolved_path)
            .map_err(|e| PluginError::new(-32000, format!("Failed to read file '{}': {}", resolved_path, e)))?;

        Ok(json!({
            "path": resolved_path,
            "content": content,
            "size": content.len()
        }))
    }

    fn execute_sql_transform(
        &self,
        node: &Value,
        ctx: &WorkflowContext,
    ) -> Result<Value, PluginError> {
        let config = node
            .get("config")
            .ok_or_else(|| PluginError::new(-32602, "Missing node config"))?;

        // 获取源 SQL
        let source_sql = if let Some(sql) = config.get("sql").and_then(|s| s.as_str()) {
            ctx.resolve_template(sql)
        } else {
            // 尝试从输入节点获取
            config
                .get("inputNode")
                .and_then(|n| n.as_str())
                .and_then(|node_id| ctx.get_node_output(node_id))
                .and_then(|output| output.get("content").and_then(|c| c.as_str()))
                .or_else(|| {
                    config.get("inputNode").and_then(|n| n.as_str())
                        .and_then(|node_id| ctx.get_node_output(node_id))
                        .and_then(|output| output.get("targetSql").and_then(|s| s.as_str()))
                })
                .ok_or_else(|| PluginError::new(-32602, "Cannot get input SQL"))?
                .to_string()
        };

        let source_dialect = config
            .get("sourceDialect")
            .and_then(|d| d.as_str())
            .unwrap_or("mysql");
        let target_dialect = config
            .get("targetDialect")
            .and_then(|d| d.as_str())
            .unwrap_or("postgresql");

        let custom_rules = config.get("customRules").and_then(|r| r.as_array());

        // 执行转换
        let result = crate::transform::translate(
            &source_sql,
            source_dialect,
            target_dialect,
            custom_rules,
        ).map_err(|e| PluginError::new(-32602, e))?;

        Ok(json!({
            "sourceDialect": source_dialect,
            "targetDialect": target_dialect,
            "sourceSql": source_sql,
            "targetSql": result,
        }))
    }

    fn execute_sql_execute(
        &self,
        node: &Value,
        ctx: &WorkflowContext,
    ) -> Result<Value, PluginError> {
        let config = node
            .get("config")
            .ok_or_else(|| PluginError::new(-32602, "Missing node config"))?;

        // 获取 SQL：优先从 config 获取，否则从 inputNode 获取
        let sql = if let Some(sql) = config.get("sql").and_then(|s| s.as_str()) {
            ctx.resolve_template(sql)
        } else if let Some(node_id) = config.get("inputNode").and_then(|n| n.as_str()) {
            ctx.get_node_output(node_id)
                .and_then(|o| o.get("targetSql").or_else(|| o.get("content")).and_then(|s| s.as_str()))
                .ok_or_else(|| PluginError::new(-32602, format!("Cannot get SQL from node '{}'", node_id)))?
                .to_string()
        } else {
            return Err(PluginError::new(-32602, "Missing SQL or inputNode in config"));
        };

        let connection_id = config.get("connectionId").and_then(|c| c.as_str()).unwrap_or("default");

        // M3 TODO: 实现真实数据库连接
        // 根据 SQL 类型返回模拟结果
        let sql_upper = sql.trim().to_uppercase();
        let (affected_rows, execution_time_ms) = if sql_upper.starts_with("SELECT") {
            (0, 50) // SELECT 返回 0 影响行
        } else if sql_upper.starts_with("INSERT") {
            (1, 30) // INSERT 返回 1 行
        } else if sql_upper.starts_with("UPDATE") || sql_upper.starts_with("DELETE") {
            (5, 40) // UPDATE/DELETE 返回模拟行数
        } else {
            (0, 20) // DDL 等
        };

        Ok(json!({
            "status": "simulated",
            "connectionId": connection_id,
            "sql": sql,
            "affectedRows": affected_rows,
            "executionTimeMs": execution_time_ms,
            "message": "SQL execution simulated (real DB connection in M3)"
        }))
    }

    fn execute_condition(
        &self,
        node: &Value,
        ctx: &WorkflowContext,
    ) -> Result<Value, PluginError> {
        let config = node
            .get("config")
            .ok_or_else(|| PluginError::new(-32602, "Missing node config"))?;

        let expression = config
            .get("expression")
            .and_then(|e| e.as_str())
            .ok_or_else(|| PluginError::new(-32602, "Missing expression"))?;

        let result = ctx
            .evaluate_expression(expression)
            .map_err(|e| PluginError::new(-32602, e))?;

        Ok(json!({
            "expression": expression,
            "result": result,
            "branch": if result { "true" } else { "false" }
        }))
    }

    fn execute_notify(
        &self,
        node: &Value,
        ctx: &WorkflowContext,
    ) -> Result<Value, PluginError> {
        let config = node
            .get("config")
            .ok_or_else(|| PluginError::new(-32602, "Missing node config"))?;

        let notify_type = config
            .get("type")
            .and_then(|t| t.as_str())
            .unwrap_or("webhook");

        let message = config
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("Workflow execution completed");

        let resolved_message = ctx.resolve_template(message);

        match notify_type {
            "webhook" | "wechat_webhook" | "dingtalk" | "feishu" => {
                let webhook_url = config
                    .get("webhookUrl")
                    .and_then(|u| u.as_str())
                    .ok_or_else(|| PluginError::new(-32602, "Missing webhook URL"))?;

                // 异步发送通知 (阻塞调用简化版)
                let _ = self.send_webhook(webhook_url, &resolved_message, notify_type);

                Ok(json!({
                    "type": notify_type,
                    "status": "sent",
                    "message": resolved_message,
                }))
            }
            _ => Err(PluginError::new(
                -32602,
                format!("Unsupported notify type: {}", notify_type),
            )),
        }
    }

    fn send_webhook(
        &self,
        url: &str,
        message: &str,
        msg_type: &str,
    ) -> Result<(), PluginError> {
        let payload = match msg_type {
            "dingtalk" => json!({
                "msgtype": "markdown",
                "markdown": {
                    "title": "Workflow Notification",
                    "text": message
                }
            }),
            _ => json!({
                "msgtype": "markdown",
                "markdown": {
                    "content": message
                }
            }),
        };

        // 使用 ureq 简化（避免复杂异步）
        let response = ureq::post(url)
            .set("Content-Type", "application/json")
            .send_json(payload);

        match response {
            Ok(resp) => {
                if resp.status() < 400 {
                    Ok(())
                } else {
                    Err(PluginError::new(
                        -32000,
                        format!("Webhook returned status {}", resp.status()),
                    ))
                }
            }
            Err(e) => Err(PluginError::new(-32000, format!("Webhook request failed: {}", e))),
        }
    }

    // === 辅助方法 ===

    fn emit(&self, method: &str, params: Value) -> Result<(), PluginError> {
        self.emitter.event(method, params).map_err(|e| PluginError::new(-32000, e.message.clone()))
    }

    fn create_execution_record(&self, workflow_id: &str) -> Result<String, PluginError> {
        let execution_id = format!("ex_{}", uuid::Uuid::new_v4().as_simple());
        let params = json!({
            "workflowId": workflow_id,
            "trigger": "manual"
        });
        let execution = self.executions.create(&params)?;
        if let Some(id) = execution.get("id").and_then(|id| id.as_str()) {
            Ok(id.to_string())
        } else {
            Ok(execution_id)
        }
    }
}
