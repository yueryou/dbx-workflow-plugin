mod api;
mod models;
mod store;
mod util;

use std::collections::HashSet;
use std::sync::Mutex;

use dbx_plugin_sdk::{
    PluginEmitter, PluginError, PluginHandler, PluginMetadata, PluginServer, RequestContext,
};
use serde_json::Value;

use crate::store::{ExecutionRepository, FileStore, WorkflowRepository};

pub struct Plugin {
    connections: Mutex<HashSet<String>>,
    workflows: WorkflowRepository,
    executions: ExecutionRepository,
}

impl Plugin {
    pub fn new() -> Result<Self, PluginError> {
        let store = FileStore::new().map_err(|e| PluginError::new(-32000, e.to_string()))?;
        Ok(Self {
            connections: Mutex::new(HashSet::new()),
            workflows: WorkflowRepository::new(store.clone()),
            executions: ExecutionRepository::new(store),
        })
    }
}

impl PluginHandler for Plugin {
    fn handle(
        &self,
        _context: RequestContext,
        method: &str,
        params: Value,
        _emitter: &PluginEmitter,
    ) -> Result<Value, PluginError> {
        match method {
            // --- existing connection protocol ---
            "connection/test" => api::connection::test_connection(&params),
            "connection/connect" => api::connection::connect(&self.connections, &params),
            "connection/disconnect" => api::connection::disconnect(&self.connections, &params),
            "dbx-workflow-plugin/ping" => api::connection::ping(&params),

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
