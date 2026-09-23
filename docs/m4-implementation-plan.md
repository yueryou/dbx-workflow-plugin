# M4: 执行可视化与实时日志实施方案

## Context

M3 已完成前端页面架构和基础 CRUD 功能。但存在以下关键问题需要解决：

**发现的关键问题（通过代码探索）**：
1. **事件订阅 API 错误**：`useEventSubscription.ts` 调用 `window.dbxPlugin.on()`，但真实 DBX 桥接 API 是 `onEvent(fn)`
2. **执行状态不持久化**：引擎发射事件但不写入文件，导致 `execution/get` 永远返回 `pending` 状态
3. **Scheduler 是死代码**：`Scheduler::start()` 从未被调用，定时任务不会触发
4. **SQL 执行是模拟的**：只返回假数据，不连接真实数据库
5. **Store 层未使用**：Zustand store 存在但页面用本地状态

M4 目标：**让执行过程可见可监控** + 修复已知问题。

---

## 一、修复清单

### 1.1 修复事件订阅 API

**问题**：`useEventSubscription.ts` 调用 `window.dbxPlugin.on()`，实际 API 是 `onEvent()`

**修改文件**：
- `ui/src/hooks/useEventSubscription.ts` - 改用 `window.dbxPlugin.onEvent()`
- `ui/src/vite-env.d.ts` - 补充 `onEvent` 类型声明

### 1.2 修复执行状态持久化

**问题**：引擎执行后状态不写入文件

**修改文件**：
- `backend/src/engine/mod.rs` - 每次状态变更时调用 `executions.update()`
- `backend/src/store/executions.rs` - 添加 `update_node_results()` 方法

### 1.3 修复 Scheduler 集成

**问题**：`Scheduler::start()` 从未调用

**修改文件**：
- `backend/src/lib.rs` - 在 `Plugin::new()` 中启动 Scheduler
- `backend/src/scheduler.rs` - 实现真实触发逻辑

---

## 二、执行可视化图谱

### 2.1 布局设计

```
┌─────────────────────────────────────────────────────────────┐
│ 执行: exec-001                    状态: ● 运行中             │
│ 进度: ████████░░░░ 4/6  耗时: 2m30s                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│    ┌──────────┐     ┌──────────┐     ┌──────────┐          │
│    │ 文件读取  │────▶│ SQL 转换  │────▶│ SQL 执行  │          │
│    │ ✓ 完成   │     │ ✓ 完成   │     │ ⟳ 运行中  │          │
│    │ 1.2s     │     │ 0.3s     │     │ 5.1s     │          │
│    └──────────┘     └──────────┘     └─────┬────┘          │
│                                            │                │
│                                   ┌────────▼────────┐      │
│                                   │ 通知            │      │
│                                   │ ○ 等待          │      │
│                                   └─────────────────┘      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 实时日志                              [暂停跟踪] [清空]     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 10:00:01 [n1] 开始执行...                    INFO       │ │
│ │ 10:00:01 [n1] 读取文件: users.sql           INFO       │ │
│ │ 10:00:01 [n2] 开始 SQL 转换...              INFO       │ │
│ │ 10:00:02 [n2] 应用规则: backtick→quote      INFO       │ │
│ │ 10:00:02 [n2] 转换完成 (0.3s)              SUCCESS    │ │
│ │ 10:00:02 [n3] 开始执行 SQL...               INFO       │ │
│ │ 10:00:07 [n3] 影响行数: 100                 SUCCESS    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 新增文件

```
ui/src/
├── components/
│   └── execution/
│       ├── ExecutionGraph.tsx      # DAG 可视化图谱
│       ├── ExecutionGraph.css      # 图谱样式
│       ├── LogStream.tsx           # 实时日志流
│       └── ProgressBar.tsx         # 执行进度条
├── pages/
│   └── executions/
│       └── ExecutionMonitor.tsx    # 执行监控页
├── store/
│   └── useExecutionStore.ts        # 重写 Store
├── hooks/
│   └── useExecutionPolling.ts      # 轮询 hook
backend/src/
└── engine/
    └── events.rs                   # 事件定义
```

### 2.3 ExecutionGraph.tsx

**自动布局算法**：
1. 按拓扑排序分层（入度=0 是第 0 层）
2. 每层节点水平均匀分布
3. 层间垂直间距固定
4. 用 SVG 绘制贝塞尔曲线连线

**节点状态颜色**：
- 等待中：灰色 `#94a3b8`
- 运行中：蓝色 `#3b82f6` + 旋转动画
- 完成：绿色 `#22c55e` + ✓ 图标
- 失败：红色 `#ef4444` + ✗ 图标
- 跳过：灰色虚线边框

---

## 三、Store 重构

### 3.1 useExecutionStore.ts 扩展

```typescript
interface ExecutionStore {
  // 现有
  executions: ExecutionSummary[];
  current: Execution | null;
  loading: boolean;
  error: string | null;
  fetchExecutions: (workflowId?: string) => Promise<void>;
  fetchExecution: (id: string) => Promise<void>;
  createExecution: (workflowId: string) => Promise<Execution>;
  cancelExecution: (id: string) => Promise<void>;

  // 新增：实时执行状态
  activeExecutionId: string | null;
  nodeStatuses: Record<string, NodeStatus>;
  logs: LogEntry[];
  polling: boolean;

  // 新增 Actions
  runExecution: (workflowId: string) => Promise<string>;
  startPolling: (executionId: string) => void;
  stopPolling: () => void;
  appendLog: (log: LogEntry) => void;
  updateNodeStatus: (nodeId: string, status: Partial<NodeStatus>) => void;
  clearActive: () => void;
}

interface NodeStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  output?: unknown;
  error?: string;
  progress?: number;
}

interface LogEntry {
  timestamp: string;
  nodeId: string;
  nodeName: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}
```

### 3.2 useExecutionPolling.ts

统一轮询逻辑，避免每个页面独立轮询：

```typescript
export function useExecutionPolling(executionId: string | null, intervalMs = 2000) {
  const { polling, startPolling, stopPolling } = useExecutionStore();

  useEffect(() => {
    if (executionId) {
      startPolling(executionId);
      return () => stopPolling();
    }
  }, [executionId]);

  return { polling };
}
```

---

## 四、后端扩展

### 4.1 engine/events.rs - 事件定义

```rust
#[derive(Serialize)]
pub struct ExecutionEvent {
    pub event_type: String,
    pub execution_id: String,
    pub timestamp: String,
    pub node_id: Option<String>,
    pub node_name: Option<String>,
    pub data: serde_json::Value,
}

impl WorkflowEngine {
    fn emit_event(&self, event_type: &str, node_id: Option<&str>, node_name: Option<&str>, data: Value) {
        let event = ExecutionEvent {
            event_type: event_type.to_string(),
            execution_id: self.execution_id.clone(),
            timestamp: util::now_iso(),
            node_id: node_id.map(|s| s.to_string()),
            node_name: node_name.map(|s| s.to_string()),
            data,
        };
        let _ = self.emitter.event(&format!("execution/{}", event_type), json!(event));
    }
}
```

### 4.2 执行状态持久化

修改 `engine/mod.rs`：

```rust
fn execute_workflow(&mut self, workflow_id: &str, execution_id: &str) -> Result<(), PluginError> {
    // 更新状态为 running
    self.executions.update_status(execution_id, ExecutionStatus::Running, None)?;

    // ... 执行逻辑 ...

    // 每个节点完成时更新
    self.executions.update_node_result(execution_id, &node_id, NodeResult { ... })?;

    // 执行完成
    self.executions.update_status(execution_id, ExecutionStatus::Completed, Some(duration))?;

    Ok(())
}
```

### 4.3 executions.rs 添加更新方法

```rust
impl ExecutionRepository {
    pub fn update_status(&self, id: &str, status: ExecutionStatus, duration_ms: Option<i64>) -> Result<(), PluginError> {
        // 读取 -> 修改状态 -> 写回
    }

    pub fn update_node_result(&self, id: &str, node_id: &str, result: NodeResult) -> Result<(), PluginError> {
        // 读取 -> 追加节点结果 -> 写回
    }

    pub fn append_log(&self, id: &str, log: LogEntry) -> Result<(), PluginError> {
        // 读取 -> 追加日志 -> 写回
    }
}
```

### 4.4 新增 API

| 方法 | 用途 | 参数 | 返回 |
|------|------|------|------|
| `execution/progress` | 查询执行进度 | `{executionId}` | `{status, nodeStatuses, logs, progress}` |
| `execution/logs` | 查询执行日志 | `{executionId}` | `{logs}` |
| `execution/stop` | 停止执行 | `{executionId}` | `{success}` |

---

## 五、Mock 模式改进

### 5.1 模拟逐步执行

```typescript
// mockApi.runExecution 改进
runExecution: async (workflowId: string) => {
  const executionId = `ex_${Date.now().toString(36)}`;
  const workflow = loadWorkflow(workflowId);

  const ex: Execution = {
    id: executionId,
    status: 'running',  // 直接设为 running
    node_results: [],
    // ...
  };
  saveExecution(ex);

  // 模拟逐步执行
  let nodeIndex = 0;
  const interval = setInterval(async () => {
    if (nodeIndex >= workflow.nodes.length) {
      clearInterval(interval);
      // 更新为完成
      const current = loadExecution(executionId);
      current.status = 'completed';
      current.finished_at = new Date().toISOString();
      saveExecution(current);
      return;
    }

    const node = workflow.nodes[nodeIndex];
    // 添加节点结果
    const current = loadExecution(executionId);
    current.node_results.push({
      node_id: node.id,
      status: Math.random() > 0.1 ? 'completed' : 'failed',
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      output: { simulated: true },
      error: null,
      attempts: 1,
    });
    saveExecution(current);

    nodeIndex++;
  }, 1000 + Math.random() * 1500);

  return { executionId, status: 'running' };
}
```

### 5.2 新增 execution/progress Mock

```typescript
getExecutionProgress: async (executionId: string) => {
  const ex = loadExecution(executionId);
  const nodeStatuses: Record<string, any> = {};
  const logs: any[] = [];

  for (const nr of ex.node_results) {
    nodeStatuses[nr.node_id] = {
      status: nr.status,
      startedAt: nr.started_at,
      finishedAt: nr.finished_at,
      output: nr.output,
      error: nr.error,
    };
    logs.push({
      timestamp: nr.started_at,
      nodeId: nr.node_id,
      level: nr.status === 'completed' ? 'success' : 'error',
      message: `节点 ${nr.node_id} ${nr.status}`,
    });
  }

  return {
    executionId,
    status: ex.status,
    progress: (ex.node_results.length / workflow.nodes.length) * 100,
    nodeStatuses,
    logs,
  };
}
```

---

## 六、实施步骤

### Phase 1: 修复基础问题 (Day 1)

1. **修复事件订阅** - `useEventSubscription.ts` 改用 `onEvent()`
2. **修复类型声明** - `vite-env.d.ts` 补充 `onEvent/onContext/onInit`
3. **修复状态持久化** - `executions.rs` 添加更新方法
4. **修复引擎状态写入** - `engine/mod.rs` 执行时更新状态

### Phase 2: 执行监控页面 (Day 1-2)

1. **新增组件** - `ExecutionGraph.tsx`（DAG 图谱）
2. **新增组件** - `LogStream.tsx`（实时日志）
3. **新增组件** - `ProgressBar.tsx`（进度条）
4. **新增页面** - `ExecutionMonitor.tsx`（整合页面）
5. **路由** - 添加 `/executions/:id/monitor`

### Phase 3: Store 重构 + 轮询 (Day 2-3)

1. **扩展 Store** - `useExecutionStore.ts` 添加实时状态
2. **新增 Hook** - `useExecutionPolling.ts`
3. **重构页面** - `ExecutionDetail.tsx` 使用 Store

### Phase 4: Mock 改进 + 测试 (Day 3-4)

1. **改进 Mock** - 模拟逐步执行
2. **端到端测试** - 创建 → 执行 → 监控 → 完成
3. **边界测试** - 失败、刷新、并发

---

## 七、验证计划

### V1: 编译验证
```bash
cd ui && npx tsc --noEmit
npx vite build
cd ../backend && cargo check && cargo test
```

### V2: 功能测试
1. 创建工作流（4+ 节点）
2. 触发执行
3. 进入监控页面
4. 验证：
   - [ ] DAG 图谱正确渲染，节点位置合理
   - [ ] 节点状态实时变化（等待→运行→完成）
   - [ ] 日志流式输出，自动滚动
   - [ ] 进度条正确显示百分比
   - [ ] 完成后自动停止轮询

### V3: 边界测试
1. 单节点工作流
2. 执行失败处理
3. 页面刷新后状态恢复
4. 执行历史数据持久化

---

## 八、验收标准

1. ✅ 执行时显示 DAG 图谱，节点自动布局
2. ✅ 节点状态实时变化（颜色+图标+耗时）
3. ✅ 日志实时流式输出，支持暂停/继续
4. ✅ 进度条显示整体进度和耗时
5. ✅ 完成后自动停止轮询
6. ✅ 执行状态持久化（刷新后可查）
7. ✅ 事件订阅 API 修复
8. ✅ TypeScript 编译无错误
9. ✅ 后端编译通过

---

## 九、不在 M4 范围内

- ❌ 真实数据库连接执行（M5）
- ❌ 拖拽式画布编辑器（M5）
- ❌ 定时任务 UI 页面（M5，但修复 Scheduler 启动）
- ❌ 真实事件推送验证（依赖 DBX 环境）
- ❌ 复杂并行执行（M5）
