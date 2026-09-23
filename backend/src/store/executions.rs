use std::path::PathBuf;

use dbx_plugin_sdk::PluginError;
use serde_json::{json, Value};

use crate::models::execution::{Execution, ExecutionStatus};
use crate::store::FileStore;
use crate::util;

#[derive(Clone)]
pub struct ExecutionRepository {
    store: FileStore,
}

impl ExecutionRepository {
    pub fn new(store: FileStore) -> Self {
        Self { store }
    }

    fn path(&self, id: &str) -> PathBuf {
        self.store.executions_dir().join(format!("{}.json", id))
    }

    pub fn list(&self, params: &Value) -> Result<Value, PluginError> {
        let mut items = Vec::new();
        let filter_wf = params.get("workflowId").and_then(|v| v.as_str());

        for entry in
            std::fs::read_dir(self.store.executions_dir())
                .map_err(|e| PluginError::new(-32000, e.to_string()))?
        {
            let path = entry
                .map_err(|e| PluginError::new(-32000, e.to_string()))?
                .path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(ex) = serde_json::from_str::<Execution>(&content) {
                        if filter_wf.map_or(true, |w| w == ex.workflow_id) {
                            items.push(json!({
                                "id": ex.id,
                                "workflow_id": ex.workflow_id,
                                "status": ex.status,
                                "started_at": ex.started_at,
                                "finished_at": ex.finished_at
                            }));
                        }
                    }
                }
            }
        }

        items.sort_by(|a, b| {
            b["started_at"]
                .as_str()
                .cmp(&a["started_at"].as_str())
        });
        Ok(Value::Array(items))
    }

    pub fn get(&self, params: &Value) -> Result<Value, PluginError> {
        let id = util::str_param(params, "id")?;
        let path = self.path(id);
        if !path.exists() {
            return Err(PluginError::new(-32602, format!("Execution not found: {}", id)));
        }
        let content = std::fs::read_to_string(path)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        Ok(serde_json::from_str(&content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?)
    }

    pub fn create(&self, params: &Value) -> Result<Value, PluginError> {
        let wf_id = util::str_param(params, "workflowId")?;
        let input = params.get("input").cloned();
        let trigger = params
            .get("trigger")
            .and_then(|v| v.as_str())
            .unwrap_or("manual");

        let execution = Execution {
            id: util::new_id("ex"),
            workflow_id: wf_id.to_string(),
            workflow_version: 1,
            status: ExecutionStatus::Pending,
            trigger: Some(trigger.to_string()),
            input,
            node_results: vec![],
            error: None,
            started_at: util::now_iso(),
            finished_at: None,
            duration_ms: 0,
        };

        let content = serde_json::to_vec_pretty(&execution)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        std::fs::write(self.path(&execution.id), content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;

        Ok(serde_json::to_value(execution)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?)
    }

    /// 获取执行日志（节点级详细日志）
    pub fn logs(&self, params: &Value) -> Result<Value, PluginError> {
        let id = util::str_param(params, "id")?;
        // 获取执行详情，包含 node_results
        let path = self.path(id);
        if !path.exists() {
            return Err(PluginError::new(-32602, format!("Execution not found: {}", id)));
        }
        let content = std::fs::read_to_string(path)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        let ex: Execution = serde_json::from_str(&content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;

        // 构建日志列表
        let logs: Vec<Value> = ex.node_results.iter().map(|nr| {
            let duration_ms = match (&nr.started_at, &nr.finished_at) {
                (Some(start), Some(end)) => {
                    if let (Ok(s), Ok(e)) = (
                        chrono::DateTime::parse_from_rfc3339(start),
                        chrono::DateTime::parse_from_rfc3339(end),
                    ) {
                        (e - s).num_milliseconds()
                    } else {
                        0
                    }
                }
                _ => 0,
            };
            json!({
                "nodeId": &nr.node_id,
                "status": &nr.status,
                "startedAt": &nr.started_at,
                "finishedAt": &nr.finished_at,
                "durationMs": duration_ms,
                "output": &nr.output,
                "error": &nr.error,
                "attempts": nr.attempts,
            })
        }).collect();

        Ok(json!({
            "executionId": &ex.id,
            "workflowId": &ex.workflow_id,
            "status": ex.status,
            "startedAt": ex.started_at,
            "finishedAt": ex.finished_at,
            "logs": logs,
        }))
    }

    pub fn cancel(&self, params: &Value) -> Result<Value, PluginError> {
        let id = util::str_param(params, "id")?;
        let path = self.path(id);
        if !path.exists() {
            return Err(PluginError::new(-32602, "Execution not found"));
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        let mut ex: Execution = serde_json::from_str(&content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;

        ex.status = ExecutionStatus::Canceled;
        ex.finished_at = Some(util::now_iso());

        let content = serde_json::to_vec_pretty(&ex)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        std::fs::write(&path, content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;

        Ok(serde_json::to_value(ex)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?)
    }
}
