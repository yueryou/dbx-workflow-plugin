use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionStatus {
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Canceled,
    Timeout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeResult {
    pub node_id: String,
    pub status: ExecutionStatus,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub output: Option<serde_json::Value>,
    pub error: Option<String>,
    pub attempts: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Execution {
    pub id: String,
    pub workflow_id: String,
    pub workflow_version: i32,
    pub status: ExecutionStatus,
    #[serde(default)]
    pub trigger: Option<String>,
    #[serde(default)]
    pub input: Option<serde_json::Value>,
    #[serde(default)]
    pub node_results: Vec<NodeResult>,
    #[serde(default)]
    pub error: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
    #[serde(default)]
    pub duration_ms: i64,
}
