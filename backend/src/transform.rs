use regex::Regex;
use serde_json::Value;

/// SQL 方言翻译器
pub fn translate(
    sql: &str,
    source: &str,
    target: &str,
    custom_rules: Option<&Vec<Value>>,
) -> Result<String, String> {
    let mut result = sql.to_string();

    // 应用内置规则
    result = apply_builtin_rules(&result, source, target)?;

    // 应用自定义规则
    if let Some(rules) = custom_rules {
        for rule in rules {
            let enabled = rule.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
            if !enabled {
                continue;
            }
            if let (Some(pattern), Some(replacement)) = (
                rule.get("pattern").and_then(|v| v.as_str()),
                rule.get("replacement").and_then(|v| v.as_str()),
            ) {
                match Regex::new(pattern) {
                    Ok(re) => {
                        result = re.replace_all(&result, replacement).to_string();
                    }
                    Err(e) => {
                        eprintln!("Invalid regex pattern '{}': {}", pattern, e);
                    }
                }
            }
        }
    }

    Ok(result)
}

/// 获取支持的方言列表
pub fn list_dialects() -> Vec<(&'static str, &'static str)> {
    vec![
        ("mysql", "MySQL / MariaDB"),
        ("postgresql", "PostgreSQL"),
        ("sqlite", "SQLite"),
        ("mssql", "Microsoft SQL Server"),
        ("oracle", "Oracle Database"),
    ]
}

fn apply_builtin_rules(sql: &str, source: &str, target: &str) -> Result<String, String> {
    let mut result = sql.to_string();

    match (source, target) {
        ("mysql", "postgresql") => {
            result = mysql_to_postgres(&result);
        }
        ("postgresql", "mysql") => {
            result = postgres_to_mysql(&result);
        }
        _ => {
            // 其他组合暂不支持内置规则
        }
    }

    Ok(result)
}

/// MySQL → PostgreSQL 转换规则
fn mysql_to_postgres(sql: &str) -> String {
    let mut result = sql.to_string();

    // 反引号 → 双引号
    let re = Regex::new(r"`([^`]+)`").unwrap();
    result = re.replace_all(&result, "\"$1\"").to_string();

    // AUTO_INCREMENT → SERIAL
    let re = Regex::new(r"(?i)(\w+)\s+(?:INT|INTEGER|BIGINT)\s+.*?AUTO_INCREMENT").unwrap();
    result = re.replace_all(&result, "${1} SERIAL").to_string();

    // DATETIME → TIMESTAMP
    let re = Regex::new(r"(?i)\bDATETIME\b").unwrap();
    result = re.replace_all(&result, "TIMESTAMP").to_string();

    // IFNULL → COALESCE
    let re = Regex::new(r"(?i)IFNULL\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)").unwrap();
    result = re.replace_all(&result, "COALESCE($1, $2)").to_string();

    // LIMIT offset, count → LIMIT count OFFSET offset
    let re = Regex::new(r"(?i)LIMIT\s+(\d+)\s*,\s*(\d+)").unwrap();
    result = re.replace_all(&result, "LIMIT $2 OFFSET $1").to_string();

    // NOW() → NOW() (兼容，无需转换)

    // GROUP_CONCAT → STRING_AGG
    let re = Regex::new(r"(?i)GROUP_CONCAT\s*\(([^)]+)\)").unwrap();
    result = re.replace_all(&result, "STRING_AGG($1, ',')").to_string();

    // 移除 ENGINE=InnoDB 等 MySQL 特有表选项
    let re = Regex::new(r"(?i)\s*ENGINE\s*=\s*\w+").unwrap();
    result = re.replace_all(&result, "").to_string();
    let re = Regex::new(r"(?i)\s*DEFAULT\s+CHARSET\s*=\s*\w+").unwrap();
    result = re.replace_all(&result, "").to_string();
    let re = Regex::new(r"(?i)\s*COLLATE\s*=\s*\w+").unwrap();
    result = re.replace_all(&result, "").to_string();

    result.trim().to_string()
}

/// PostgreSQL → MySQL 转换规则
fn postgres_to_mysql(sql: &str) -> String {
    sql.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_mysql_backtick_to_pg_quote() {
        let sql = "SELECT `name`, `age` FROM `users`";
        let result = mysql_to_postgres(sql);
        assert_eq!(result, "SELECT \"name\", \"age\" FROM \"users\"");
    }

    #[test]
    fn test_mysql_autoincrement_to_serial() {
        let sql = "id INT AUTO_INCREMENT PRIMARY KEY";
        let result = mysql_to_postgres(sql);
        assert!(result.contains("SERIAL"));
    }

    #[test]
    fn test_mysql_ifnull_to_coalesce() {
        let sql = "SELECT IFNULL(name, 'unknown') FROM users";
        let result = mysql_to_postgres(sql);
        assert_eq!(result, "SELECT COALESCE(name, 'unknown') FROM users");
    }

    #[test]
    fn test_mysql_limit_offset() {
        let sql = "SELECT * FROM users LIMIT 10, 20";
        let result = mysql_to_postgres(sql);
        assert_eq!(result, "SELECT * FROM users LIMIT 20 OFFSET 10");
    }

    #[test]
    fn test_custom_rules() {
        let sql = "SELECT OLD_FUNCTION(x) FROM t";
        let rules = vec![
            json!({"pattern": "OLD_FUNCTION", "replacement": "NEW_FUNCTION", "enabled": true}),
        ];
        let result = translate(sql, "mysql", "postgresql", Some(&rules)).unwrap();
        assert!(result.contains("NEW_FUNCTION"));
    }
}
