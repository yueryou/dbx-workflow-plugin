# M3: 前端完善与真实功能实现实施方案

## Context

M2 完成后，发现严重问题：
- **前端几乎是个空壳**：工作流创建只有一个"名称"输入框，没有 SQL 编辑器、没有连接选择、没有节点配置
- **后端模型不完整**：NodeType 枚举缺少 `file_read`、`sql_transform`、`sql_execute`、`notify`
- **Mock 数据字段名不匹配**：用 `label` 而不是 `name`，用 `from/to` 而不是 `source_node/target_node`
- **缺少页面路由**：没有 pages 目录，无法导航到工作流详情/编辑器

M3 目标是让插件**真正可用**：用户能创建包含 SQL 转换节点的完整工作流，配置数据库连接，执行并查看结果。

---

## 一、后端模型修复（必须先做）

### 1.1 扩展 NodeType 枚举

**文件**: `backend/src/models/workflow.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum NodeType {
    Start,
    End,
    Http,
    Script,
    Condition,
    Wait,
    DataSource,
    Transform,
    Approval,
    SubWorkflow,
    // M3 新增
    FileRead,      // "file_read"
    SqlTransform,  // "sql_transform"
    SqlExecute,    // "sql_execute"
    Notify,        // "notify"
}
```

### 1.2 修复 Mock 数据字段名

**文件**: `ui/src/api/mock.ts`

所有节点必须使用 `name`（不是 `label`），边必须使用 `source_node`/`target_node`（不是 `from`/`to`），边必须有 `id`。

**修复前**:
```typescript
{ id: 'n1', node_type: 'start', label: '开始', ... }
{ from: 'n1', to: 'n2' }
```

**修复后**:
```typescript
{ id: 'n1', node_type: 'start', name: '开始', ... }
{ id: 'e1', source_node: 'n1', target_node: 'n2' }
```

### 1.3 修复 Mock 工作流配置

Mock 中的 `sql_transform` 和 `sql_execute` 节点需要完整的 config：

```typescript
{
  id: 'n3',
  node_type: 'sql_transform',
  name: 'MySQL → PostgreSQL 转换',
  config: {
    inputNode: 'n2',           // 从上游节点获取 SQL
    sourceDialect: 'mysql',
    targetDialect: 'postgresql',
    customRules: [
      { name: 'Remove BACKTICK', pattern: '`', replacement: '"', enabled: true }
    ]
  },
  inputs: [{ id: 'i1', label: 'sql' }],
  outputs: [{ id: 'o1', label: 'converted' }]
}
```

---

## 二、前端页面架构（M3 核心）

### 2.1 新增依赖

```json
{
  "dependencies": {
    "react-router-dom": "^6.28.0"   // 页面路由
  }
}
```

### 2.2 页面路由设计

```
/workflows              → WorkflowList（列表页）
/workflows/new          → WorkflowCreator（创建向导）
/workflows/:id          → WorkflowDetail（详情页）
/workflows/:id/edit     → WorkflowEditor（编辑器）
/executions             → ExecutionHistory（执行历史）
/executions/:id         → ExecutionDetail（执行详情）
/settings               → Settings（设置页）
/settings/connections   → ConnectionManager（连接管理）
/settings/notifications → NotificationConfig（通知配置）
```

### 2.3 新增文件结构

```
ui/src/
├── App.tsx                        # 更新：使用 react-router
├── pages/
│   ├── WorkflowList.tsx           # 从 components 移过来
│   ├── WorkflowCreator.tsx        # 新增：创建向导（多步骤）
│   ├── WorkflowDetail.tsx         # 新增：工作流详情
│   ├── WorkflowEditor.tsx         # 新增：节点编辑器
│   ├── ExecutionHistory.tsx       # 新增：执行历史列表
│   ├── ExecutionDetail.tsx        # 新增：执行详情
│   └── Settings.tsx              # 新增：设置页
├── components/
│   ├── layout/
│   │   └── Layout.tsx             # 已有
│   ├── workflow/
│   │   ├── NodeConfigPanel.tsx    # 新增：节点配置面板
│   │   ├── SqlTransformConfig.tsx # 新增：SQL 转换配置
│   │   ├── ConnectionSelector.tsx # 新增：连接选择器
│   │   └── CustomRulesEditor.tsx  # 新增：自定义规则编辑器
│   ├── execution/
│   │   ├── ExecutionPanel.tsx     # 新增：执行面板
│   │   ├── ExecutionLog.tsx       # 新增：执行日志
│   │   └── NodeStatusBadge.tsx    # 新增：节点状态徽章
│   └── settings/
│       ├── ConnectionForm.tsx     # 新增：连接表单
│       └── NotificationForm.tsx   # 新增：通知配置表单
├── hooks/
│   ├── useExecution.ts            # 新增：执行状态管理
│   └── useEventSubscription.ts    # 新增：事件订阅
└── store/
    ├── useWorkflowStore.ts        # 已有，扩展
    ├── useExecutionStore.ts       # 已有，扩展
    └── useConnectionStore.ts      # 新增：连接配置状态
```

---

## 三、核心页面详细设计

### 3.1 工作流创建向导 (WorkflowCreator)

**目标**：引导用户一步步创建完整的工作流，而不是只输入名称。

**步骤**:
1. **基本信息**：名称、描述、标签
2. **选择模板**：SQL 同步 / 数据备份 / ETL / 自定义
3. **配置源**：选择源数据库连接 + 输入 SQL（或选择文件）
4. **配置转换**：选择源/目标方言 + 自定义规则
5. **配置目标**：选择目标数据库连接
6. **预览确认**：显示完整的工作流结构

**UI 组件**:
```tsx
function WorkflowCreator() {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    name: '',
    description: '',
    template: 'sql_sync',
    sourceConnection: '',
    targetConnection: '',
    sourceDialect: 'mysql',
    targetDialect: 'postgresql',
    sql: '',
    customRules: [] as CustomRule[],
  });

  return (
    <Stepper active={step}>
      <Stepper.Step label="基本信息">
        <TextInput label="工作流名称" value={config.name} onChange={...} />
        <Textarea label="描述" value={config.description} onChange={...} />
        <TagsInput label="标签" value={config.tags} onChange={...} />
      </Stepper.Step>
      
      <Stepper.Step label="选择模板">
        <TemplateSelector
          options={[
            { id: 'sql_sync', name: 'SQL 数据同步', icon: 'database' },
            { id: 'backup', name: '数据备份', icon: 'backup' },
            { id: 'etl', name: 'ETL 管道', icon: 'transform' },
            { id: 'custom', name: '自定义', icon: 'code' },
          ]}
          value={config.template}
          onChange={...}
        />
      </Stepper.Step>
      
      <Stepper.Step label="配置数据源">
        <ConnectionSelector
          label="源数据库"
          value={config.sourceConnection}
          onChange={...}
        />
        <SqlEditor
          label="SQL 查询"
          value={config.sql}
          dialect={config.sourceDialect}
          onChange={...}
        />
      </Stepper.Step>
      
      <Stepper.Step label="配置转换">
        <DialectSelector source={config.sourceDialect} target={config.targetDialect} />
        <CustomRulesEditor rules={config.customRules} onChange={...} />
        <TransformPreview sql={config.sql} source={config.sourceDialect} target={config.targetDialect} />
      </Stepper.Step>
      
      <Stepper.Step label="配置目标">
        <ConnectionSelector label="目标数据库" value={config.targetConnection} onChange={...} />
      </Stepper.Step>
      
      <Stepper.Step label="确认">
        <WorkflowPreview config={config} />
      </Stepper.Step>
    </Stepper>
  );
}
```

### 3.2 工作流详情页 (WorkflowDetail)

**布局**:
```
┌─────────────────────────────────────────────────────────────┐
│  ← 返回列表          MySQL → PostgreSQL 数据同步     [编辑] │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │ 基本信息            │  │ 执行历史                     │  │
│  │ 名称: xxx           │  │ ┌─────────────────────────┐ │  │
│  │ 描述: xxx           │  │ │ 2026-09-22 14:30  ✓ 成功 │ │  │
│  │ 版本: v2            │  │ │ 2026-09-21 10:00  ✗ 失败 │ │  │
│  │ 标签: [同步][MySQL] │  │ └─────────────────────────┘ │  │
│  │ 节点数: 5           │  │                             │  │
│  └─────────────────────┘  └─────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 工作流结构                                           │   │
│  │                                                     │   │
│  │  [开始] → [读取文件] → [SQL转换] → [执行SQL] → [结束]│   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [运行工作流]  [复制]  [删除]                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 节点配置面板 (NodeConfigPanel)

当用户在编辑器中选中节点时显示：

```tsx
function NodeConfigPanel({ node, onChange }: { node: WorkflowNode; onChange: (n: WorkflowNode) => void }) {
  const config = (node.config || {}) as Record<string, any>;

  switch (node.node_type) {
    case 'sql_transform':
      return (
        <Stack>
          <TextInput label="节点名称" value={node.name} onChange={e => onChange({...node, name: e.target.value})} />
          <Select label="源方言" value={config.sourceDialect} data={dialects} onChange={v => onChange({...node, config: {...config, sourceDialect: v}})} />
          <Select label="目标方言" value={config.targetDialect} data={dialects} onChange={v => onChange({...node, config: {...config, targetDialect: v}})} />
          <CustomRulesEditor rules={config.customRules || []} onChange={rules => onChange({...node, config: {...config, customRules: rules}})} />
        </Stack>
      );
    case 'sql_execute':
      return (
        <Stack>
          <TextInput label="节点名称" value={node.name} onChange={e => onChange({...node, name: e.target.value})} />
          <ConnectionSelector label="数据库连接" value={config.connectionId} onChange={v => onChange({...node, config: {...config, connectionId: v}})} />
          <Select label="SQL 来源" value={config.inputNode ? 'node' : 'inline'} onChange={...} />
          {config.inputNode ? (
            <Select label="输入节点" value={config.inputNode} data={upstreamNodes} onChange={...} />
          ) : (
            <SqlEditor label="SQL" value={config.sql} onChange={v => onChange({...node, config: {...config, sql: v}})} />
          )}
        </Stack>
      );
    // ... 其他节点类型
  }
}
```

### 3.4 SQL 编辑器组件

```tsx
import { CodeHighlight } from '@mantine/code-highlight';

function SqlEditor({ value, onChange, dialect, label }: SqlEditorProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>{label}</Text>
      <CodeHighlight
        code={value}
        language="sql"
        copyLabel="复制"
        copiedLabel="已复制"
      />
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          fontFamily: 'monospace',
          minHeight: 200,
          padding: 12,
          borderRadius: 8,
          border: '1px solid var(--mantine-color-default-border)',
        }}
        placeholder="输入 SQL 查询..."
      />
    </Stack>
  );
}
```

### 3.5 连接管理器 (ConnectionManager)

```tsx
function ConnectionManager() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [editing, setEditing] = useState<DbConnection | null>(null);

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>数据库连接</Text>
        <Button onClick={() => setEditing({} as DbConnection)}>添加连接</Button>
      </Group>
      
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>名称</Table.Th>
            <Table.Th>类型</Table.Th>
            <Table.Th>主机</Table.Th>
            <Table.Th>数据库</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {connections.map(conn => (
            <Table.Tr key={conn.id}>
              <Table.Td>{conn.name}</Table.Td>
              <Table.Td><Badge>{conn.driver}</Badge></Table.Td>
              <Table.Td>{conn.host}:{conn.port}</Table.Td>
              <Table.Td>{conn.database}</Table.Td>
              <Table.Td>
                <Badge color={conn.status === 'connected' ? 'green' : 'gray'}>
                  {conn.status}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon onClick={() => testConnection(conn.id)}><IconTestPipe /></ActionIcon>
                  <ActionIcon onClick={() => setEditing(conn)}><IconEdit /></ActionIcon>
                  <ActionIcon color="red" onClick={() => deleteConnection(conn.id)}><IconTrash /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      
      {editing && <ConnectionForm connection={editing} onSave={...} onCancel={() => setEditing(null)} />}
    </Stack>
  );
}
```

### 3.6 连接表单 (ConnectionForm)

```tsx
function ConnectionForm({ connection, onSave, onCancel }: ConnectionFormProps) {
  const [form, setForm] = useState(connection);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTest = async () => {
    setTesting(true);
    const result = await api.testConnection(form);
    setTestResult(result.success ? 'success' : 'error');
    setTesting(false);
  };

  return (
    <Paper withBorder p="md">
      <Stack>
        <Select
          label="数据库类型"
          value={form.driver}
          data={[
            { value: 'mysql', label: 'MySQL' },
            { value: 'postgresql', label: 'PostgreSQL' },
            { value: 'sqlite', label: 'SQLite' },
            { value: 'mssql', label: 'SQL Server' },
            { value: 'oracle', label: 'Oracle' },
          ]}
          onChange={v => setForm({...form, driver: v})}
        />
        <TextInput label="连接名称" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <Group grow>
          <TextInput label="主机" value={form.host} onChange={e => setForm({...form, host: e.target.value})} />
          <NumberInput label="端口" value={form.port} onChange={v => setForm({...form, port: v as number})} />
        </Group>
        <TextInput label="数据库" value={form.database} onChange={e => setForm({...form, database: e.target.value})} />
        <TextInput label="用户名" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
        <PasswordInput label="密码" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
        
        <Group>
          <Button variant="outline" onClick={handleTest} loading={testing}>
            测试连接
          </Button>
          {testResult === 'success' && <Badge color="green">连接成功</Badge>}
          {testResult === 'error' && <Badge color="red">连接失败</Badge>}
        </Group>
        
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>取消</Button>
          <Button onClick={() => onSave(form)}>保存</Button>
        </Group>
      </Stack>
    </Paper>
  );
}
```

---

## 四、API 扩展

### 4.1 新增后端 API

| 方法 | 用途 | 参数 | 返回 |
|------|------|------|------|
| `connection/list` | 列出连接 | - | 连接列表 |
| `connection/create` | 创建连接 | `{config}` | `{id}` |
| `connection/update` | 更新连接 | `{id, config}` | `{success}` |
| `connection/test` | 测试连接 | `{id}` | `{success, message}` |
| `connection/delete` | 删除连接 | `{id}` | `{success}` |
| `execution/logs` | 执行日志 | `{executionId}` | 日志列表 |
| `workflow/duplicate` | 复制工作流 | `{id}` | 新工作流 |

### 4.2 新增 Store

**useConnectionStore.ts**:
```typescript
interface ConnectionState {
  connections: DbConnection[];
  loading: boolean;
  error: string | null;
  fetchConnections: () => Promise<void>;
  createConnection: (config: DbConnectionInput) => Promise<DbConnection>;
  updateConnection: (id: string, config: Partial<DbConnectionInput>) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; message: string }>;
}
```

---

## 五、实现步骤（按依赖顺序）

### Phase 1: 后端修复（Day 1）
1. 扩展 NodeType 枚举（添加 file_read, sql_transform, sql_execute, notify）
2. 添加 connection 存储和 API
3. 添加 execution/logs API
4. 运行 cargo test 确保通过

### Phase 2: Mock 数据修复（Day 1）
1. 修复节点字段名（label → name）
2. 修复边字段名（from/to → source_node/target_node，添加 id）
3. 修复节点 config（添加完整的 sql_transform/sql_execute 配置）
4. 添加 connections mock 数据

### Phase 3: 前端路由和页面骨架（Day 2）
1. 安装 react-router-dom
2. 重构 App.tsx 使用路由
3. 创建 pages 目录和空页面组件
4. 确保路由切换正常

### Phase 4: 工作流创建向导（Day 3-4）
1. 创建 WorkflowCreator 页面
2. 实现 Stepper 多步骤表单
3. 创建 ConnectionSelector 组件
4. 创建 SqlEditor 组件
5. 创建 CustomRulesEditor 组件
6. 创建 TransformPreview 组件

### Phase 5: 工作流详情和编辑器（Day 5-6）
1. 创建 WorkflowDetail 页面
2. 创建 WorkflowEditor 页面
3. 创建 NodeConfigPanel 组件
4. 实现节点选中/配置逻辑

### Phase 6: 执行历史和详情（Day 7）
1. 创建 ExecutionHistory 页面
2. 创建 ExecutionDetail 页面
3. 创建 ExecutionPanel 组件
4. 实现事件订阅 hook

### Phase 7: 设置页面（Day 8）
1. 创建 Settings 页面
2. 创建 ConnectionManager 页面
3. 创建 ConnectionForm 组件
4. 创建 NotificationForm 组件

### Phase 8: 集成测试（Day 9-10）
1. 端到端测试：创建 → 配置 → 执行 → 查看历史
2. 前端 UI 交互测试
3. 后端 API 测试
4. 修复所有 bug

---

## 六、验证计划

### V1: 后端编译和测试
```bash
cd backend
cargo check
cargo test
```

### V2: 前端编译
```bash
cd ui
npm install  # 安装 react-router-dom
npx tsc --noEmit
npx vite build
```

### V3: 端到端测试
1. 启动前端：`npm run dev`
2. 访问 http://localhost:5192/
3. 测试流程：
   - [ ] 点击 "New Workflow"
   - [ ] 输入名称和描述
   - [ ] 选择 "SQL 同步" 模板
   - [ ] 配置源数据库连接
   - [ ] 输入 SQL 查询
   - [ ] 选择源/目标方言
   - [ ] 添加自定义规则
   - [ ] 预览转换结果
   - [ ] 保存工作流
   - [ ] 在工作流详情页点击 "运行"
   - [ ] 查看执行进度
   - [ ] 查看执行历史

### V4: 连接管理测试
1. 进入 Settings → Connections
2. 添加 MySQL 连接
3. 点击 "测试连接"
4. 验证连接成功

---

## 七、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| react-router 与 DBX 沙箱冲突 | 路由失效 | 使用 HashRouter 而非 BrowserRouter |
| SQL 编辑器体积过大 | 加载慢 | 使用轻量 textarea + 简单高亮 |
| 连接信息泄露 | 安全问题 | 密码字段使用 PasswordInput，不显示明文 |
| 节点配置复杂 | 用户困惑 | 提供模板和默认值 |

---

## 八、验收标准

1. ✅ 用户能创建包含完整节点配置的工作流
2. ✅ 工作流创建向导引导用户完成所有配置
3. ✅ SQL 编辑器支持输入和语法高亮
4. ✅ 转换预览实时显示转换结果
5. ✅ 数据库连接可配置和测试
6. ✅ 工作流可执行并查看实时进度
7. ✅ 执行历史可查询
8. ✅ 设置页面可管理连接和通知

---

**此方案确保 M3 完成后，插件是一个真正可用的产品，而非演示 demo。**
