use std::collections::HashSet;
use std::path::PathBuf;

use dbx_plugin_sdk::PluginError;
use serde_json::{json, Value};

use crate::models::workflow::{Workflow, WorkflowInput, NodeType};
use crate::store::FileStore;
use crate::util;

#[derive(Clone)]
pub struct WorkflowRepository {
    store: FileStore,
}

impl WorkflowRepository {
    pub fn new(store: FileStore) -> Self {
        Self { store }
    }

    fn path(&self, id: &str) -> PathBuf {
        self.store.workflows_dir().join(format!("{}.json", id))
    }

    pub fn list(&self, _params: &Value) -> Result<Value, PluginError> {
        let mut items = Vec::new();
        for entry in
            std::fs::read_dir(self.store.workflows_dir())
                .map_err(|e| PluginError::new(-32000, e.to_string()))?
        {
            let path = entry
                .map_err(|e| PluginError::new(-32000, e.to_string()))?
                .path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(w) = serde_json::from_str::<Workflow>(&content) {
                        items.push(json!({
                            "id": w.id,
                            "name": w.name,
                            "version": w.version,
                            "tags": w.tags,
                            "updated_at": w.updated_at,
                            "node_count": w.nodes.len()
                        }));
                    }
                }
            }
        }
        items.sort_by(|a, b| {
            b["updated_at"]
                .as_str()
                .cmp(&a["updated_at"].as_str())
        });
        Ok(Value::Array(items))
    }

    pub fn get(&self, params: &Value) -> Result<Value, PluginError> {
        let id = util::str_param(params, "id")?;
        self.get_value(id)
    }

    /// 通过 ID 获取工作流（内部使用）
    pub fn get_value(&self, id: &str) -> Result<Value, PluginError> {
        let path = self.path(id);
        if !path.exists() {
            return Err(PluginError::new(-32602, format!("Workflow not found: {}", id)));
        }
        let content = std::fs::read_to_string(path)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        Ok(serde_json::from_str(&content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?)
    }

    pub fn create(&self, params: &Value) -> Result<Value, PluginError> {
        let input: WorkflowInput = serde_json::from_value(
            params
                .get("input")
                .cloned()
                .unwrap_or_default(),
        )
        .map_err(|e| PluginError::new(-32602, e.to_string()))?;

        let now = util::now_iso();
        let workflow = Workflow {
            id: util::new_id("wf"),
            version: 1,
            name: input.name,
            description: input.description,
            tags: input.tags,
            nodes: input.nodes,
            edges: input.edges,
            global_config: None,
            created_at: now.clone(),
            updated_at: now,
        };

        let content = serde_json::to_vec_pretty(&workflow)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        std::fs::write(self.path(&workflow.id), content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;

        Ok(serde_json::to_value(workflow)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?)
    }

    pub fn update(&self, params: &Value) -> Result<Value, PluginError> {
        let id = util::str_param(params, "id")?;
        let path = self.path(id);
        if !path.exists() {
            return Err(PluginError::new(-32602, "Workflow not found"));
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        let mut wf: Workflow = serde_json::from_str(&content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;

        if let Some(input) = params.get("input") {
            if let Some(n) = input.get("name").and_then(|v| v.as_str()) {
                wf.name = n.to_string();
            }
            if input.get("description").is_some() {
                wf.description = input
                    .get("description")
                    .and_then(|v| v.as_str())
                    .map(String::from);
            }
            if let Some(t) = input.get("tags").and_then(|v| v.as_array()) {
                wf.tags = t
                    .iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect();
            }
            if let Some(n) = input.get("nodes").and_then(|v| v.as_array()) {
                wf.nodes = n
                    .iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect();
            }
            if let Some(e) = input.get("edges").and_then(|v| v.as_array()) {
                wf.edges = e
                    .iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect();
            }
        }

        wf.version += 1;
        wf.updated_at = util::now_iso();

        let content = serde_json::to_vec_pretty(&wf)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        std::fs::write(&path, content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;

        Ok(serde_json::to_value(wf)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?)
    }

    pub fn delete(&self, params: &Value) -> Result<Value, PluginError> {
        let id = util::str_param(params, "id")?;
        let path = self.path(id);
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        }
        Ok(json!({ "success": true, "id": id }))
    }

    pub fn validate(&self, params: &Value) -> Result<Value, PluginError> {
        let wf: Workflow = match params.get("id") {
            Some(_) => {
                let id = util::str_param(params, "id")?;
                let path = self.path(id);
                if !path.exists() {
                    return Err(PluginError::new(-32602, "Workflow not found"));
                }
                let content = std::fs::read_to_string(path)
                    .map_err(|e| PluginError::new(-32000, e.to_string()))?;
                serde_json::from_str(&content)
                    .map_err(|e| PluginError::new(-32000, e.to_string()))?
            }
            None => {
                let input = params.get("input").cloned().unwrap_or_default();
                serde_json::from_value(input)
                    .map_err(|e| PluginError::new(-32602, e.to_string()))?
            }
        };

        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        let has_start = wf.nodes.iter().any(|n| matches!(n.node_type, NodeType::Start));
        let has_end = wf.nodes.iter().any(|n| matches!(n.node_type, NodeType::End));

        if !has_start {
            errors.push("Missing Start node".to_string());
        }
        if !has_end {
            errors.push("Missing End node".to_string());
        }

        // Unreachable node detection via BFS from Start
        if has_start {
            let mut visited = HashSet::new();
            let start_id = wf
                .nodes
                .iter()
                .find(|n| matches!(n.node_type, NodeType::Start))
                .map(|n| n.id.clone())
                .unwrap();
            let mut queue = vec![start_id];

            while let Some(current) = queue.pop() {
                if visited.insert(current.clone()) {
                    for edge in &wf.edges {
                        if edge.source_node == current {
                            queue.push(edge.target_node.clone());
                        }
                    }
                }
            }

            for node in &wf.nodes {
                if !visited.contains(&node.id) {
                    warnings.push(format!("Unreachable node: {}", node.name));
                }
            }
        }

        Ok(json!({
            "valid": errors.is_empty(),
            "errors": errors,
            "warnings": warnings
        }))
    }
}
