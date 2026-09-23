use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashMap;

/// 节点执行输出
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeOutput {
    pub status: NodeStatus,
    pub data: Value,
    pub error: Option<String>,
    pub started_at: String,
    pub finished_at: String,
    pub duration_ms: i64,
}

/// 节点执行状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum NodeStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

/// 工作流执行上下文 - 节点间数据传递
#[derive(Debug, Clone)]
pub struct WorkflowContext {
    pub workflow_id: String,
    pub execution_id: String,
    pub variables: Map<String, Value>,
    pub node_outputs: HashMap<String, Value>,
}

impl WorkflowContext {
    pub fn new(workflow_id: String, execution_id: String) -> Self {
        Self {
            workflow_id,
            execution_id,
            variables: Map::new(),
            node_outputs: HashMap::new(),
        }
    }

    /// 设置全局变量
    pub fn set_variable(&mut self, key: &str, value: Value) {
        self.variables.insert(key.to_string(), value);
    }

    /// 获取全局变量
    pub fn get_variable(&self, key: &str) -> Option<&Value> {
        self.variables.get(key)
    }

    /// 设置节点输出
    pub fn set_node_output(&mut self, node_id: &str, output: Value) {
        self.node_outputs.insert(node_id.to_string(), output.clone());
        self.variables.insert(format!("{}.output", node_id), output);
    }

    /// 获取节点输出
    pub fn get_node_output(&self, node_id: &str) -> Option<&Value> {
        self.node_outputs.get(node_id)
    }

    /// 解析模板表达式 ${path.to.value}
    pub fn resolve_template(&self, template: &str) -> String {
        let re = match regex::Regex::new(r"\$\{([^}]+)\}") {
            Ok(re) => re,
            Err(_) => return template.to_string(),
        };

        re.replace_all(template, |caps: &regex::Captures| {
            let path = &caps[1];
            self.resolve_path(path)
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_else(|| format!("${{{}}}", path))
        })
        .into_owned()
    }

    /// 解析路径 (如 node-1.output.affectedRows)
    fn resolve_path(&self, path: &str) -> Option<&Value> {
        let parts: Vec<&str> = path.split('.').collect();
        let first = parts.first()?;

        // 首先尝试直接获取（如 node_outputs 中的完整 JSON）
        if let Some(output) = self.node_outputs.get(*first) {
            // 从 output 开始遍历剩余路径（跳过第一个 part）
            let mut current = output;
            for part in &parts[1..] {
                current = current.as_object().and_then(|obj| obj.get(*part))?;
            }
            return Some(current);
        }

        // 回退到 variables 查找
        let mut current = match self.variables.get(*first) {
            Some(v) => v,
            None => return None,
        };

        for part in &parts[1..] {
            current = current.as_object().and_then(|obj| obj.get(*part))?;
        }
        Some(current)
    }

    /// 评估简单比较表达式
    pub fn evaluate_expression(&self, expression: &str) -> Result<bool, String> {
        let parts: Vec<&str> = expression.split_whitespace().collect();
        if parts.len() != 3 {
            return Err("Invalid expression format: expected 'left op right'".to_string());
        }

        // 解析左操作数：尝试从上下文获取，否则使用原始值
        let left = if let Some(val) = self.resolve_path(parts[0]) {
            if let Some(n) = val.as_i64() {
                n.to_string()
            } else if let Some(n) = val.as_f64() {
                n.to_string()
            } else if let Some(s) = val.as_str() {
                s.to_string()
            } else {
                val.to_string()
            }
        } else {
            parts[0].to_string()
        };

        // 解析右操作数
        let right = if let Some(val) = self.resolve_path(parts[2]) {
            if let Some(n) = val.as_i64() {
                n.to_string()
            } else if let Some(n) = val.as_f64() {
                n.to_string()
            } else if let Some(s) = val.as_str() {
                s.to_string()
            } else {
                val.to_string()
            }
        } else {
            parts[2].to_string()
        };

        // 尝试数字比较
        if let (Ok(l), Ok(r)) = (left.parse::<f64>(), right.parse::<f64>()) {
            match parts[1] {
                ">" => Ok(l > r),
                "<" => Ok(l < r),
                ">=" => Ok(l >= r),
                "<=" => Ok(l <= r),
                "==" => Ok((l - r).abs() < f64::EPSILON),
                "!=" => Ok((l - r).abs() >= f64::EPSILON),
                _ => Err(format!("Unknown operator: {}", parts[1])),
            }
        } else {
            // 字符串比较
            match parts[1] {
                "==" => Ok(left == right),
                "!=" => Ok(left != right),
                _ => Err(format!("Cannot compare strings with '{}'", parts[1])),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_set_and_get_variable() {
        let mut ctx = WorkflowContext::new("wf-1".to_string(), "ex-1".to_string());
        ctx.set_variable("name", json!("test"));
        assert_eq!(ctx.get_variable("name").unwrap(), "test");
    }

    #[test]
    fn test_node_output() {
        let mut ctx = WorkflowContext::new("wf-1".to_string(), "ex-1".to_string());
        ctx.set_node_output("node-1", json!({"rows": 100}));

        let output = ctx.get_node_output("node-1").unwrap();
        assert_eq!(output["rows"], 100);
        assert_eq!(ctx.get_variable("node-1.output").unwrap()["rows"], 100);
    }

    #[test]
    fn test_resolve_template() {
        let mut ctx = WorkflowContext::new("wf-1".to_string(), "ex-1".to_string());
        ctx.set_variable("name", json!("world"));
        let result = ctx.resolve_template("Hello ${name}!");
        assert_eq!(result, "Hello world!");
    }

    #[test]
    fn test_evaluate_expression_numeric() {
        let mut ctx = WorkflowContext::new("wf-1".to_string(), "ex-1".to_string());
        ctx.set_node_output("node-1", json!({"affectedRows": 100}));
        assert!(ctx.evaluate_expression("node-1.affectedRows > 0").unwrap());
        assert!(!ctx.evaluate_expression("node-1.affectedRows < 0").unwrap());
    }

    #[test]
    fn test_evaluate_expression_string() {
        let mut ctx = WorkflowContext::new("wf-1".to_string(), "ex-1".to_string());
        ctx.set_node_output("node-1", json!({"status": "success"}));
        assert!(ctx.evaluate_expression("node-1.status == success").unwrap());
    }
}
