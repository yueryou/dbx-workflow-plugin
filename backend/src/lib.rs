mod api;
mod engine;
mod models;
mod scheduler;
mod store;
mod transform;
mod util;

use std::sync::Mutex;

use dbx_plugin_sdk::{
    PluginEmitter, PluginError, PluginHandler, PluginMetadata, PluginServer, RequestContext,
};
use serde_json::{json, Value};

use crate::engine::WorkflowEngine;
use crate::store::{ConnectionRepository, ExecutionRepository, FileStore, WorkflowRepository};

pub struct Plugin {
    workflows: WorkflowRepository,
    executions: ExecutionRepository,
    connections: ConnectionRepository,
    engine: Mutex<Option<WorkflowEngine>>,
}

impl Plugin {
    pub fn new() -> Result<Self, PluginError> {
        let store = FileStore::new().map_err(|e| PluginError::new(-32000, e.to_string()))?;
        Ok(Self {
            workflows: WorkflowRepository::new(store.clone()),
            executions: ExecutionRepository::new(store.clone()),
            connections: ConnectionRepository::new(store),
            engine: Mutex::new(None),
        })
    }

    fn init_engine(&self, emitter: PluginEmitter) -> WorkflowEngine {
        let store = FileStore::new().expect("Failed to init store");
        WorkflowEngine::new(store, emitter)
    }
}

impl PluginHandler for Plugin {
    fn handle(
        &self,
        _context: RequestContext,
        method: &str,
        params: Value,
        emitter: &PluginEmitter,
    ) -> Result<Value, PluginError> {
        match method {
            // --- existing connection protocol (DBX host connection) ---
            "connection/test" => api::connection::test_connection(&params),
            "dbx-workflow-plugin/ping" => api::connection::ping(&params),

            // --- M3: workflow connection management (saved DB connections) ---
            "connection/list" => self.connections.list(&params),
            "connection/create" => self.connections.create(&params),
            "connection/update" => self.connections.update(&params),
            "connection/delete" => self.connections.delete(&params),

            // --- workflow CRUD ---
            "workflow/list" => self.workflows.list(&params),
            "workflow/get" => self.workflows.get(&params),
            "workflow/create" => self.workflows.create(&params),
            "workflow/update" => self.workflows.update(&params),
            "workflow/delete" => self.workflows.delete(&params),
            "workflow/validate" => self.workflows.validate(&params),

            // --- execution CRUD ---
            "execution/list" => self.executions.list(&params),
            "execution/get" => self.executions.get(&params),
            "execution/create" => self.executions.create(&params),
            "execution/cancel" => self.executions.cancel(&params),
            "execution/logs" => self.executions.logs(&params),

            // --- M2: workflow execution ---
            "execution/run" => {
                let workflow_id = util::str_param(&params, "workflowId")?;
                let engine = self.init_engine(emitter.clone());
                match engine.run(workflow_id.to_string()) {
                    Ok(execution_id) => Ok(json!({
                        "executionId": execution_id,
                        "status": "pending"
                    })),
                    Err(e) => Err(e),
                }
            }

            // --- M2: SQL transform ---
            "transform/sql" => {
                let sql = util::str_param(&params, "sql")?;
                let source = params.get("sourceDialect").and_then(|d| d.as_str()).unwrap_or("mysql");
                let target = params.get("targetDialect").and_then(|d| d.as_str()).unwrap_or("postgresql");
                let custom_rules = params.get("customRules").and_then(|r| r.as_array());

                match transform::translate(&sql, source, target, custom_rules) {
                    Ok(result) => Ok(json!({
                        "sql": result,
                        "sourceDialect": source,
                        "targetDialect": target,
                    })),
                    Err(e) => Err(PluginError::new(-32602, e)),
                }
            }

            "transform/dialects" => {
                let dialects: Vec<serde_json::Value> = transform::list_dialects()
                    .into_iter()
                    .map(|(id, name)| json!({"id": id, "name": name}))
                    .collect();
                Ok(json!(dialects))
            }

            // --- M2: schedule management ---
            "schedule/list" => {
                let repo = scheduler::ScheduleRepository::new(FileStore::new().map_err(|e| PluginError::new(-32000, e.to_string()))?);
                repo.list(&params)
            }
            "schedule/create" => {
                let repo = scheduler::ScheduleRepository::new(FileStore::new().map_err(|e| PluginError::new(-32000, e.to_string()))?);
                repo.create(&params)
            }
            "schedule/delete" => {
                let repo = scheduler::ScheduleRepository::new(FileStore::new().map_err(|e| PluginError::new(-32000, e.to_string()))?);
                repo.delete(&params)
            }

            // --- M2: notification test ---
            "notify/test" => {
                let config = params.get("config").cloned().unwrap_or_default();
                let notify_type = config.get("type").and_then(|t| t.as_str()).unwrap_or("webhook");
                let message = config.get("message").and_then(|m| m.as_str()).unwrap_or("Test notification");

                match notify_type {
                    "webhook" | "wechat_webhook" | "dingtalk" | "feishu" => {
                        let webhook_url = config.get("webhookUrl").and_then(|u| u.as_str())
                            .ok_or_else(|| PluginError::new(-32602, "Missing webhookUrl"))?;

                        let payload = json!({
                            "msgtype": "markdown",
                            "markdown": { "content": message }
                        });

                        let response = ureq::post(webhook_url)
                            .set("Content-Type", "application/json")
                            .send_json(payload);

                        match response {
                            Ok(resp) => {
                                if resp.status() < 400 {
                                    Ok(json!({ "success": true, "status": resp.status() }))
                                } else {
                                    Ok(json!({ "success": false, "status": resp.status(), "error": format!("HTTP {}", resp.status()) }))
                                }
                            }
                            Err(e) => Ok(json!({ "success": false, "error": e.to_string() })),
                        }
                    }
                    _ => Err(PluginError::new(-32602, format!("Unsupported type: {}", notify_type))),
                }
            }

            _ => Err(PluginError::method_not_found(method)),
        }
    }
}

pub fn run() -> std::io::Result<()> {
    let metadata = PluginMetadata::new(
        "io.github.yueryou.workflow",
        env!("CARGO_PKG_VERSION"),
    )
    .with_capability("connections");
    PluginServer::new(metadata, Plugin::new().expect("plugin init")).serve()
}
