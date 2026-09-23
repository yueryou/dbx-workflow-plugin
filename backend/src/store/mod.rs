pub mod connections;
pub mod executions;
pub mod workflows;

pub use connections::ConnectionRepository;
pub use executions::ExecutionRepository;
pub use workflows::WorkflowRepository;

use std::path::PathBuf;

#[derive(Clone)]
pub struct FileStore {
    root: PathBuf,
}

impl FileStore {
    pub fn new() -> Result<Self, std::io::Error> {
        let base = directories::ProjectDirs::from("com.yueryou", "yueryou", "WorkflowManage")
            .map(|d| d.data_dir().to_path_buf())
            .unwrap_or_else(|| PathBuf::from(".dbx-dev/workflow-manage"));
        let root = base;
        std::fs::create_dir_all(root.join("workflows"))?;
        std::fs::create_dir_all(root.join("executions"))?;
        std::fs::create_dir_all(root.join("schedules"))?;
        std::fs::create_dir_all(root.join("connections"))?;
        Ok(Self { root })
    }

    pub fn workflows_dir(&self) -> PathBuf {
        self.root.join("workflows")
    }

    pub fn executions_dir(&self) -> PathBuf {
        self.root.join("executions")
    }

    pub fn schedules_dir(&self) -> PathBuf {
        self.root.join("schedules")
    }

    pub fn connections_dir(&self) -> PathBuf {
        self.root.join("connections")
    }
}
