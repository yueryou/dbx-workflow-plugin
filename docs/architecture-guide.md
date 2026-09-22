# DBX Workflow Plugin 项目技术架构详解

## 一、项目概述

这是一个 **DBX 插件项目**，使用 `dbx-plugin create` 工具通过 **Rust + 前端** 模板生成的空项目。

**DBX** 是一个数据库管理工具（类似 DBeaver/DataGrip），它支持通过插件扩展功能。你的插件名为 **"Workflow Manage"**（工作流管理），ID 为 `io.github.yueryou.workflow`。

---

## 二、整体架构：Sidecar 模式

DBX 插件采用 **Sidecar（边车）架构**：

```
┌─────────────────────────────────────────────────────┐
│                    DBX 主程序                         │
│  ┌──────────────┐         ┌─────────────────────┐   │
│  │   UI 前端     │◄───────►│  后端 Sidecar       │   │
│  │  (沙箱环境)   │  Host   │  (Rust 原生二进制)   │   │
│  │  ui/         │ Bridge  │  backend/           │   │
│  └──────────────┘         └─────────────────────┘   │
│         │                          │                │
│         └──────────┬───────────────┘                │
│                    │                                │
│              数据库/外部服务                          │
└─────────────────────────────────────────────────────┘
```

**核心概念：**
- **UI 前端**：运行在沙箱中的网页，负责用户界面展示
- **后端 Sidecar**：编译为原生二进制的 Rust 程序，负责业务逻辑
- **Host Bridge**：DBX 主程序提供的通信桥梁，连接 UI 和 Sidecar

---

## 三、目录结构详解

```
dbx-workflow-plugin/
├── manifest.json          # 🔧 插件清单文件（核心配置）
├── dbx-plugin.toml        # 🔧 构建工具配置
├── README.md              # 📖 项目说明
├── LICENSE                # 📄 Apache-2.0 许可证
│
├── backend/               # 🦀 Rust 后端（Sidecar）
│   ├── Cargo.toml         # Rust 项目配置
│   ├── Cargo.lock         # 依赖锁定文件
│   └── src/
│       └── main.rs        # 后端入口文件
│
├── ui/                    # 🌐 前端 UI（沙箱页面）
│   └── index.html         # 单页面应用入口
│
├── assets/                # 🎨 静态资源
│   └── plugin.svg         # 插件图标
│
├── dist/                  # 📦 构建产物（gitignore）
│   ├── *.dbxp             # 可分发的插件包
│   └── *.artifact.json    # 构建元数据
│
├── .github/
│   └── workflows/
│       └── plugin-release.yml  # 🚀 CI/CD 自动发布
│
├── .idea/                 # 🔨 IDE 配置（gitignore）
└── .gitignore             # Git 忽略规则
```

---

## 四、各模块详细说明

### 1. `manifest.json` — 插件清单（核心）

这是 DBX 系统识别和加载插件的**关键文件**：

| 字段 | 说明 |
|------|------|
| `manifest_version` | 清单版本（当前为 1） |
| `id` | 插件唯一标识：`io.github.yueryou.workflow` |
| `name` | 显示名称：`Workflow Manage` |
| `version` | 语义化版本：`0.1.0` |
| `publisher` | 发布者：`yueryou` |
| `engines.dbx` | 最低 DBX 版本要求：`>=0.5.68` |
| `entrypoints.backend` | 后端可执行文件路径 |
| `entrypoints.ui` | 前端入口 HTML 路径 |
| `contributions` | 插件贡献点声明 |
| `localizations` | 国际化翻译 |

**贡献点类型：**
- `connection-provider`：声明连接提供器（可配置 host/port 等连接参数）
- `workbench`：声明工作台 UI（沙箱页面）

### 2. `dbx-plugin.toml` — 构建配置

```toml
schema_version = 1

[backend]
language = "rust"                    # 后端语言
directory = "backend"                # 后端目录
binary = "dbx-plugin-dbx-workflow-plugin"  # 输出二进制名

[package]
include = ["assets", "ui"]           # 打包时包含的目录
```

### 3. `backend/` — Rust 后端

**技术栈：**
- **语言**：Rust (edition 2021)
- **核心依赖**：`dbx-plugin-sdk` (v0.1.0)
- **序列化**：`serde_json`

**SDK 核心类型：**

```rust
// 插件元数据
PluginMetadata::new("io.github.yueryou.workflow", "0.1.0")
    .with_capability("connections")   // 声明能力

// 插件处理器 trait
trait PluginHandler {
    fn handle(
        &self,
        context: RequestContext,    // 请求上下文
        method: &str,               // 方法名（路由）
        params: Value,              // 参数（JSON）
        emitter: &PluginEmitter,    // 事件发射器
    ) -> Result<Value, PluginError>;
}

// 服务器
PluginServer::new(metadata, handler).serve()
```

**当前已实现的方法路由：**

| 方法 | 功能 |
|------|------|
| `connection/test` | 测试连接配置 |
| `connection/connect` | 注册连接 |
| `connection/disconnect` | 断开连接 |
| `dbx-workflow-plugin/ping` | Ping 测试 |

### 4. `ui/` — 前端 UI

**技术栈：**
- 纯 HTML + 原生 JavaScript（无框架）
- 通过 `window.dbxPlugin` 全局对象与后端通信

**Host Bridge API：**

```javascript
// 等待就绪
window.dbxPlugin.ready.then(() => { ... });

// 获取当前语言
window.dbxPlugin.locale;  // "en" | "zh-CN" 等

// 获取上下文（如 connectionId）
window.dbxPlugin.context?.connectionId;

// 调用后端方法
await window.dbxPlugin.invoke("method/path", params);
```

### 5. `.github/workflows/plugin-release.yml` — CI/CD

自动发布流程：
1. 创建 GitHub Release 时触发
2. 调用 `dbx-plugin package .` 构建插件包
3. 上传到 Release Assets
4. 如果配置了 `autoUpdate: true`，自动提交 PR 到 DBX Store

---

## 五、通信协议

### UI → Sidecar 通信

```javascript
// 前端调用
const result = await window.dbxPlugin.invoke("method/path", {
    connectionId: "xxx",
    // ... 其他参数
});
```

```rust
// 后端处理
fn handle(&self, context: RequestContext, method: &str, params: Value, emitter: &PluginEmitter) -> Result<Value, PluginError> {
    match method {
        "method/path" => {
            // 处理逻辑
            Ok(json!({ "ok": true }))
        }
        _ => Err(PluginError::method_not_found(method)),
    }
}
```

### 错误处理

```rust
// 标准错误码
-32602  // 参数错误
-32000  // 服务器错误
```

---

## 六、开发流程

### 本地开发

```bash
# 启动开发模式（无需 DBX 主程序）
dbx-plugin dev --path . --port 5190

# 构建可安装包
dbx-plugin package .
```

### 发布流程

1. 更新 `manifest.json` 中的 `version`
2. 创建 GitHub Release
3. CI 自动构建并上传
4. 提交到 DBX Store（可选）

---

## 七、开发规约

### 命名规范
- **插件 ID**：反向域名格式 `io.github.yueryou.workflow`
- **方法路径**：使用 `/` 分隔，如 `dbx-workflow-plugin/ping`
- **连接字段**：使用 snake_case，如 `display_name`

### 安全注意事项
- `.dbx-dev/` 目录包含开发凭证，**不要提交**
- `.dbx-repository-signing-key.env` 包含签名密钥，**不要提交**
- UI 运行在沙箱中，只能通过 Host Bridge 与后端通信

### 国际化
- 在 `manifest.json` 的 `localizations` 字段添加翻译
- 前端通过 `window.dbxPlugin.locale` 获取当前语言

---

## 八、文档维护记录

| 日期 | 修改内容 | 作者 |
|------|----------|------|
| 2026-09-22 | 初始版本创建 | Claude Code |
