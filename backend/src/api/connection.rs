use std::collections::HashSet;
use std::sync::Mutex;

use dbx_plugin_sdk::PluginError;
use serde_json::{json, Value};

pub fn test_connection(params: &Value) -> Result<Value, PluginError> {
    let connection = params.get("connection").cloned().unwrap_or_default();
    Ok(json!({
        "success": true,
        "message": format!(
            "Workflow Manage is ready for {}:{}.",
            connection.get("host").and_then(Value::as_str).unwrap_or("localhost"),
            connection.get("port").and_then(Value::as_u64).unwrap_or(0)
        )
    }))
}

pub fn connect(connections: &Mutex<HashSet<String>>, params: &Value) -> Result<Value, PluginError> {
    let connection_id = connection_id(params)?;
    connections
        .lock()
        .map_err(|_| PluginError::new(-32000, "Connection registry is poisoned"))?
        .insert(connection_id.to_string());
    Ok(json!({ "success": true }))
}

pub fn disconnect(connections: &Mutex<HashSet<String>>, params: &Value) -> Result<Value, PluginError> {
    let connection_id = connection_id(params)?;
    connections
        .lock()
        .map_err(|_| PluginError::new(-32000, "Connection registry is poisoned"))?
        .remove(connection_id);
    Ok(json!({ "success": true }))
}

pub fn ping(params: &Value) -> Result<Value, PluginError> {
    Ok(json!({
        "ok": true,
        "plugin": "io.github.yueryou.workflow",
        "language": "rust",
        "connectionId": params.get("connectionId").cloned().unwrap_or(Value::Null)
    }))
}

fn connection_id(params: &Value) -> Result<&str, PluginError> {
    params
        .get("connection")
        .and_then(|connection| connection.get("id"))
        .and_then(Value::as_str)
        .ok_or_else(|| PluginError::new(-32602, "Missing connection id"))
}
