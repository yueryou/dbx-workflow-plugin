use std::fs;
use std::path::PathBuf;

use dbx_plugin_sdk::PluginError;
use serde_json::{json, Value};

use super::FileStore;

#[derive(Clone)]
pub struct ConnectionRepository {
    store: FileStore,
}

impl ConnectionRepository {
    pub fn new(store: FileStore) -> Self {
        Self { store }
    }

    fn dir(&self) -> PathBuf {
        self.store.connections_dir()
    }

    /// 列出所有连接（不含密码）
    pub fn list(&self, _params: &Value) -> Result<Value, PluginError> {
        let dir = self.dir();
        let mut connections = Vec::new();

        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if entry.path().extension().and_then(|e| e.to_str()) == Some("json") {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Ok(mut conn) = serde_json::from_str::<Value>(&content) {
                            // 移除敏感信息
                            if let Some(obj) = conn.as_object_mut() {
                                obj.remove("password");
                            }
                            connections.push(conn);
                        }
                    }
                }
            }
        }

        Ok(json!(connections))
    }

    /// 创建连接
    pub fn create(&self, params: &Value) -> Result<Value, PluginError> {
        let id = params
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("conn_{}", uuid::Uuid::new_v4().as_simple()));

        let mut conn = json!({
            "id": &id,
        });

        // 合并用户提供的字段
        if let (Some(obj), Some(params_obj)) = (conn.as_object_mut(), params.as_object()) {
            for (k, v) in params_obj {
                if k != "id" {
                    obj.insert(k.clone(), v.clone());
                }
            }
        }

        // 添加时间戳
        if let Some(obj) = conn.as_object_mut() {
            obj.insert("createdAt".to_string(), json!(crate::util::now_iso()));
            obj.insert("updatedAt".to_string(), json!(crate::util::now_iso()));
        }

        let path = self.dir().join(format!("{}.json", id));
        fs::write(&path, serde_json::to_string_pretty(&conn).unwrap())
            .map_err(|e| PluginError::new(-32000, format!("Failed to write connection: {}", e)))?;

        // 返回时移除密码
        if let Some(obj) = conn.as_object_mut() {
            obj.remove("password");
        }

        Ok(conn)
    }

    /// 更新连接
    pub fn update(&self, params: &Value) -> Result<Value, PluginError> {
        let id = params
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| PluginError::new(-32602, "Missing connection id"))?;

        let path = self.dir().join(format!("{}.json", id));

        // 读取现有连接
        let content = fs::read_to_string(&path)
            .map_err(|_| PluginError::new(-32602, format!("Connection '{}' not found", id)))?;

        let mut conn: Value = serde_json::from_str(&content)
            .map_err(|e| PluginError::new(-32600, format!("Invalid connection data: {}", e)))?;

        // 合并更新
        if let (Some(obj), Some(params_obj)) = (conn.as_object_mut(), params.as_object()) {
            for (k, v) in params_obj {
                if k != "id" {
                    obj.insert(k.clone(), v.clone());
                }
            }
            obj.insert("updatedAt".to_string(), json!(crate::util::now_iso()));
        }

        fs::write(&path, serde_json::to_string_pretty(&conn).unwrap())
            .map_err(|e| PluginError::new(-32000, format!("Failed to write connection: {}", e)))?;

        // 返回时移除密码
        if let Some(obj) = conn.as_object_mut() {
            obj.remove("password");
        }

        Ok(conn)
    }

    /// 删除连接
    pub fn delete(&self, params: &Value) -> Result<Value, PluginError> {
        let id = params
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| PluginError::new(-32602, "Missing connection id"))?;

        let path = self.dir().join(format!("{}.json", id));

        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| PluginError::new(-32000, format!("Failed to delete connection: {}", e)))?;
            Ok(json!({ "success": true, "id": id }))
        } else {
            Err(PluginError::new(-32602, format!("Connection '{}' not found", id)))
        }
    }

    /// 获取单个连接（含密码，内部使用）
    pub fn get(&self, id: &str) -> Result<Value, PluginError> {
        let path = self.dir().join(format!("{}.json", id));
        let content = fs::read_to_string(&path)
            .map_err(|_| PluginError::new(-32602, format!("Connection '{}' not found", id)))?;

        serde_json::from_str(&content)
            .map_err(|e| PluginError::new(-32600, format!("Invalid connection data: {}", e)))
    }
}
