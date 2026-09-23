use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use cron::Schedule;
use std::str::FromStr;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use dbx_plugin_sdk::PluginError;

use crate::store::FileStore;
use crate::util;

/// 定时任务模型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJob {
    pub id: String,
    pub workflow_id: String,
    pub cron_expression: String,
    pub enabled: bool,
    pub last_triggered_at: Option<String>,
    pub next_trigger_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// 创建定时任务的输入
#[derive(Debug, Deserialize)]
pub struct CronJobInput {
    pub workflow_id: String,
    pub cron_expression: String,
    #[serde(default)]
    pub enabled: bool,
}

/// 定时任务仓库
#[derive(Clone)]
pub struct ScheduleRepository {
    store: FileStore,
}

impl ScheduleRepository {
    pub fn new(store: FileStore) -> Self {
        Self { store }
    }

    pub fn list(&self, _params: &Value) -> Result<Value, PluginError> {
        let mut items = Vec::new();
        for entry in std::fs::read_dir(self.store.schedules_dir())
            .map_err(|e| PluginError::new(-32000, e.to_string()))?
        {
            let path = entry.map_err(|e| PluginError::new(-32000, e.to_string()))?.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(job) = serde_json::from_str::<CronJob>(&content) {
                        items.push(json!({
                            "id": job.id,
                            "workflow_id": job.workflow_id,
                            "cron_expression": job.cron_expression,
                            "enabled": job.enabled,
                            "last_triggered_at": job.last_triggered_at,
                            "next_trigger_at": job.next_trigger_at,
                        }));
                    }
                }
            }
        }
        Ok(Value::Array(items))
    }

    pub fn create(&self, params: &Value) -> Result<Value, PluginError> {
        let input: CronJobInput = serde_json::from_value(params.get("input").cloned().unwrap_or_default())
            .map_err(|e| PluginError::new(-32602, e.to_string()))?;

        // 验证 cron 表达式
        Schedule::from_str(&input.cron_expression)
            .map_err(|e| PluginError::new(-32602, format!("Invalid cron expression: {}", e)))?;

        let now = util::now_iso();
        let job = CronJob {
            id: util::new_id("sch"),
            workflow_id: input.workflow_id,
            cron_expression: input.cron_expression,
            enabled: input.enabled,
            last_triggered_at: None,
            next_trigger_at: None,
            created_at: now.clone(),
            updated_at: now,
        };

        let path = self.store.schedules_dir().join(format!("{}.json", job.id));
        let content = serde_json::to_vec_pretty(&job)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        std::fs::write(path, content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;

        Ok(serde_json::to_value(job).map_err(|e| PluginError::new(-32000, e.to_string()))?)
    }

    pub fn delete(&self, params: &Value) -> Result<Value, PluginError> {
        let id = util::str_param(params, "id")?;
        let path = self.store.schedules_dir().join(format!("{}.json", id));
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        }
        Ok(json!({ "success": true, "id": id }))
    }

    pub fn list_enabled(&self) -> Result<Vec<CronJob>, PluginError> {
        let mut items = Vec::new();
        if !self.store.schedules_dir().exists() {
            return Ok(items);
        }
        for entry in std::fs::read_dir(self.store.schedules_dir())
            .map_err(|e| PluginError::new(-32000, e.to_string()))?
        {
            let path = entry.map_err(|e| PluginError::new(-32000, e.to_string()))?.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(job) = serde_json::from_str::<CronJob>(&content) {
                        if job.enabled {
                            items.push(job);
                        }
                    }
                }
            }
        }
        Ok(items)
    }

    pub fn update_last_triggered(&self, id: &str, triggered_at: &str) -> Result<(), PluginError> {
        let path = self.store.schedules_dir().join(format!("{}.json", id));
        if !path.exists() {
            return Ok(());
        }
        let content = std::fs::read_to_string(&path)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        let mut job: CronJob = serde_json::from_str(&content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        job.last_triggered_at = Some(triggered_at.to_string());
        job.updated_at = util::now_iso();
        let new_content = serde_json::to_vec_pretty(&job)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        std::fs::write(path, new_content)
            .map_err(|e| PluginError::new(-32000, e.to_string()))?;
        Ok(())
    }
}

/// 调度器
pub struct Scheduler {
    repo: ScheduleRepository,
    running: Arc<AtomicBool>,
    handle: Mutex<Option<thread::JoinHandle<()>>>,
}

impl Scheduler {
    pub fn new(repo: ScheduleRepository) -> Self {
        Self {
            repo,
            running: Arc::new(AtomicBool::new(false)),
            handle: Mutex::new(None),
        }
    }

    /// 启动调度器（在后台线程中运行）
    pub fn start(&self) -> Result<(), PluginError> {
        self.running.store(true, Ordering::SeqCst);
        let running = self.running.clone();
        let repo = self.repo.clone();

        let handle = thread::spawn(move || {
            while running.load(Ordering::SeqCst) {
                if let Err(e) = Self::check_and_trigger(&repo) {
                    eprintln!("[Scheduler] Error: {}", e.message);
                }
                // 每分钟检查一次
                thread::sleep(Duration::from_secs(60));
            }
        });

        if let Ok(mut h) = self.handle.lock() {
            *h = Some(handle);
        }

        Ok(())
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        if let Ok(mut h) = self.handle.lock() {
            if let Some(handle) = h.take() {
                let _ = handle.join();
            }
        }
    }

    fn check_and_trigger(repo: &ScheduleRepository) -> Result<(), PluginError> {
        use chrono::Utc;

        let jobs = repo.list_enabled()?;
        let now = Utc::now();

        for job in jobs {
            let schedule = match Schedule::from_str(&format!("0 {}", job.cron_expression)) {
                Ok(s) => s,
                Err(_) => continue,
            };

            let should_trigger = if let Some(last) = &job.last_triggered_at {
                if let Ok(last_dt) = chrono::DateTime::parse_from_rfc3339(last) {
                    let last_dt = last_dt.with_timezone(&Utc);
                    if let Some(next) = schedule.after(&last_dt).next() {
                        now >= next
                    } else {
                        false
                    }
                } else {
                    false
                }
            } else {
                // 从未触发过，立即触发一次
                true
            };

            if should_trigger {
                let now_iso = Utc::now().to_rfc3339();
                if let Err(e) = repo.update_last_triggered(&job.id, &now_iso) {
                    eprintln!("[Scheduler] Failed to update trigger time: {}", e.message);
                }
                println!("[Scheduler] Would trigger workflow {} at {}", job.workflow_id, now_iso);
            }
        }

        Ok(())
    }
}
