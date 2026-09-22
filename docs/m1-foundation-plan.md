# M1: 基础框架实现计划

## 一、目标

为 DBX Workflow Manage 插件搭建完整的项目基础框架，包括：
- 后端 Rust 模块化重构（从单文件拆分为多模块）
- 前端 React + TypeScript + Vite 项目脚手架
- 构建配置更新
- 核心数据模型定义
- 工作流 CRUD API 实现
- 端到端通信验证

## 二、技术发现

### 2.1 SDK API
- 使用 `match method` 字符串路由，JSON-RPC 2.0 风格
- 错误码: -32602 (参数错误), -32000 (server error), -32601 (method not found)
- `window.dbxPlugin.invoke(method, params)` 是唯一通信通道
- `PluginEmitter.event()` 可推送事件给 UI

### 2.2 前端栈
- Vite 6 + React 18 + TypeScript 5
- Zustand 5 状态管理
- Mantine 7 UI 组件库
- react-i18next 国际化
- Vite `base: './'` 适配 DBX 沙箱

### 2.3 存储方案
- `directories` crate 获取跨平台数据目录
- 工作流/执行记录以 JSON 文件格式存储
- Windows: `%APPDATA%\yueryou\WorkflowManage\workflows\`

## 三、API 方法清单

### 3.1 连接协议（DBX 要求）

| 方法 | 用途 | 参数 | 返回 |
|------|------|------|------|
| `connection/test` | 连接测试握手 | `{connection}` | `{success,message}` |
| `connection/connect` | 注册连接 | `{connection}` | `{success}` |
| `connection/disconnect` | 注销连接 | `{connection}` | `{success}` |
| `dbx-workflow-plugin/ping` | 健康检查 | `{connectionId?}` | `{ok,plugin,language,connectionId}` |

### 3.2 工作流 CRUD

| 方法 | 用途 | 参数 | 返回 |
|------|------|------|------|
| `workflow/list` | 列出工作流 | `{}` | `[{id,name,version,tags,updated_at,node_count}]` |
| `workflow/get` | 获取详情 | `{id}` | `Workflow` |
| `workflow/create` | 创建工作流 | `{input:{name,nodes,edges,...}}` | `Workflow` |
| `workflow/update` | 更新工作流 | `{id,input:{...}}` | `Workflow` |
| `workflow/delete` | 删除工作流 | `{id}` | `{success,id}` |
| `workflow/validate` | 结构校验 | `{id}` 或 `{input}` | `{valid,errors[],warnings[]}` |

### 3.3 执行记录 CRUD

| 方法 | 用途 | 参数 | 返回 |
|------|------|------|------|
| `execution/list` | 列出执行记录 | `{workflowId?}` | `[{id,workflow_id,status,started_at,finished_at}]` |
| `execution/get` | 获取执行详情 | `{id}` | `Execution` |
| `execution/create` | 创建执行记录 | `{workflowId,trigger?,input?}` | `Execution` |
| `execution/cancel` | 取消执行 | `{id}` | `Execution` |

## 四、数据模型

### 4.1 Workflow

```rust
pub struct Workflow {
    pub id: String,
    pub name: String,
    pub version: i32,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub nodes: Vec<WorkflowNode>,
    pub edges: Vec<WorkflowEdge>,
    pub global_config: Option<Value>,
    pub created_at: String,   // ISO-8601
    pub updated_at: String,
}
```

### 4.2 WorkflowNode

```rust
pub struct WorkflowNode {
    pub id: String,
    pub node_type: NodeType,
    pub name: String,
    pub description: Option<String>,
    pub inputs: Vec<WorkflowPort>,
    pub outputs: Vec<WorkflowPort>,
    pub config: Option<Value>,
    pub position: Option<Position>,
}
```

### 4.3 NodeType 枚举

```rust
pub enum NodeType {
    Start,        // 开始节点
    End,          // 结束节点
    Http,         // HTTP 请求
    Script,       // 脚本执行
    Condition,    // 条件分支
    Wait,         // 等待/延时
    DataSource,   // 数据库查询
    Transform,    // 数据转换
    Approval,     // 人工审批
    SubWorkflow,  // 子工作流
}
```

### 4.4 Execution

```rust
pub struct Execution {
    pub id: String,
    pub workflow_id: String,
    pub workflow_version: i32,
    pub status: ExecutionStatus,
    pub trigger: Option<String>,
    pub input: Option<Value>,
    pub node_results: Vec<NodeResult>,
    pub error: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub duration_ms: i64,
}
```

### 4.5 ExecutionStatus 枚举

```rust
pub enum ExecutionStatus {
    Pending,    // 等待中
    Running,    // 运行中
    Paused,     // 已暂停
    Completed,  // 已完成
    Failed,     // 失败
    Canceled,   // 已取消
    Timeout,    // 超时
}
```

## 五、目标目录结构

```
dbx-workflow-plugin/
├── manifest.json               # 插件清单
├── dbx-plugin.toml             # 构建配置（已更新 frontend 支持）
├── scripts/
│   └── build.sh                # 一键构建脚本
├── backend/                    # Rust 后端
│   ├── Cargo.toml              # 依赖：serde/chrono/uuid/directories
│   └── src/
│       ├── main.rs             # 薄入口
│       ├── lib.rs              # 模块入口 + Plugin 路由
│       ├── models/             # 数据模型
│       │   ├── mod.rs
│       │   ├── workflow.rs
│       │   └── execution.rs
│       ├── store/              # 存储层
│       │   ├── mod.rs          # FileStore
│       │   ├── workflows.rs    # 工作流 CRUD
│       │   └── executions.rs   # 执行记录 CRUD
│       ├── api/                # API 处理
│       │   ├── mod.rs
│       │   ├── connection.rs
│       │   ├── workflow.rs
│       │   └── execution.rs
│       └── util.rs             # 工具函数
├── ui/                         # React 前端
│   ├── package.json
│   ├── vite.config.ts          # base: './'
│   ├── index.html
│   └── src/
│       ├── main.tsx            # 入口 (await bridge ready)
│       ├── App.tsx             # 主应用 (Tab 路由)
│       ├── theme.ts            # Mantine 主题
│       ├── i18n.ts             # react-i18next
│       ├── vite-env.d.ts       # window.dbxPlugin 类型
│       ├── api/
│       │   ├── client.ts       # Host Bridge 封装 + Mock 模式
│       │   ├── types.ts        # 共享 TS 类型
│       │   └── mock.ts         # 离线开发模拟数据
│       ├── store/
│       │   ├── useWorkflowStore.ts  # Zustand 工作流状态
│       │   └── useExecutionStore.ts # Zustand 执行状态
│       └── components/
│           ├── Layout.tsx      # AppShell 布局
│           ├── WorkflowList.tsx # 工作流列表
│           └── Placeholder.tsx  # 占位组件
└── assets/
    └── plugin.svg
```

## 六、前端 Mock 模式

为了支持独立开发测试（不依赖 DBX bridge），前端实现了自动降级：

```typescript
const hasBridge = typeof window !== 'undefined' && window.dbxPlugin != null;

export const api = {
  isMockMode: !hasBridge,
  listWorkflows: async () => {
    if (!hasBridge) return mockApi.listWorkflows();  // 使用模拟数据
    return invoke('workflow/list', {});              // 调用真实后端
  },
  // ...
};
```

Mock 模式包含 2 条示例工作流和 2 条执行记录，支持完整的 CRUD 操作。

## 七、依赖清单

### 7.1 Rust (backend/Cargo.toml)

```toml
[dependencies]
dbx-plugin-sdk = { version = "0.1.0" }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde", "clock"] }
uuid = { version = "1", features = ["v4"] }
directories = "5"
```

### 7.2 前端 (ui/package.json)

```json
{
  "dependencies": {
    "@mantine/core": "^7.16.0",
    "@mantine/hooks": "^7.16.0",
    "@tabler/icons-react": "^3.30.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-i18next": "^15.4.0",
    "i18next": "^24.2.0",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.3",
    "vite": "^6.0.11",
    "postcss": "^8.5.1",
    "postcss-preset-mantine": "^1.17.0",
    "postcss-simple-vars": "^7.0.1"
  }
}
```

## 八、构建配置

### 8.1 dbx-plugin.toml

```toml
schema_version = 1

[backend]
language = "rust"
directory = "backend"
binary = "dbx-plugin-dbx-workflow-plugin"
command = "cargo build --release"

[frontend]
language = "javascript"
directory = "ui"
command = "npm install && npm run build"

[package]
include = ["assets", "ui/dist"]
```

### 8.2 scripts/build.sh

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> [backend] cargo build --release"
( cd "$ROOT/backend" && cargo build --release )

echo "==> [frontend] npm install && build"
( cd "$ROOT/ui" && npm ci && npm run build )

echo "==> Done."
```

## 九、验证结果

### 9.1 构建验证

```
==> [backend] cargo build --release  ✅  40.07s
==> [frontend] npm install && build   ✅  ~4m + 7.54s
```

### 9.2 前端 UI 验证

通过 `npx vite preview --port 5191` 访问 `http://127.0.0.1:5191/`：
- ✅ 顶部导航栏正常渲染
- ✅ 左侧导航 (Workflows/Executions/Settings)
- ✅ 工作流列表表格展示（含示例数据）
- ✅ Demo Mode 标签
- ✅ 新建/删除工作流功能
- ✅ 中英文国际化

### 9.3 后端 API 验证

`cargo check` 编译通过，模块结构正确。

## 十、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `dbx-plugin` CLI 不支持 `[frontend]` 配置 | 打包失败 | 使用 `scripts/build.sh` 手动构建 |
| JSON 并发写入冲突 | 数据损坏 | M1 单用户可接受，M2 加锁或换 SQLite |
| `directories` crate 返回 None | 数据目录不可用 | fallback 到 `.dbx-dev/workflow-manage` |
| `window.dbxPlugin` 类型不匹配 | 运行时错误 | `vite-env.d.ts` 声明 + try/catch |

## 十一、不在 M1 范围内

以下功能推迟到后续里程碑：
- 工作流执行引擎（实际运行节点）
- SQL 方言转换
- 定时任务调度（Cron）
- 条件分支/并行执行
- 企业微信通知
- 可视化执行图谱
- 拖拽式工作流编辑器

## 十二、后续里程碑

- **M2**: 后端核心（执行引擎 + SQL 转换 + 通知）
- **M3**: 前端完善（执行历史页面 + 工作流编辑器）
- **M4**: 高级功能（定时触发 + 条件分支 + 可视化图谱）
