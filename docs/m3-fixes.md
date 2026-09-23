# M3 Bug 修复报告

**修复时间**: 2026-09-22
**修复人员**: Claude Code

---

## 修复清单

### Fix 1: 实现 localStorage 持久化 ✅

**问题描述**: 创建的工作流、执行记录、连接配置刷新页面后丢失

**解决方案**:
1. 重构 `mock.ts` 使用 localStorage 作为持久化存储
2. 添加 `loadFromStorage<T>()` 和 `saveToStorage<T>()` 工具函数
3. 定义 `STORAGE_KEYS` 常量管理存储键名
4. 首次加载时自动填充默认数据（示例工作流、连接、执行记录）
5. 所有 CRUD 操作都同步到 localStorage

**修改文件**:
- `ui/src/api/mock.ts` - 完全重写，添加持久化层

**测试验证**:
- ✅ 刷新页面后数据保留
- ✅ 创建新工作流后刷新仍存在
- ✅ 删除工作流后刷新确认删除
- ✅ 执行记录刷新后保留

---

### Fix 2: 连接管理集成真实数据 ✅

**问题描述**: 工作流创建向导的连接选择器显示假数据

**解决方案**:
1. `ConnectionSelector` 组件调用 `api.listConnections()` 获取真实数据
2. 连接数据存储在 localStorage，与设置页面共享
3. 提供"添加新连接"链接跳转到设置页面

**修改文件**:
- `ui/src/components/workflow/ConnectionSelector.tsx` - 已实现
- `ui/src/pages/workflows/WorkflowCreator.tsx` - 使用 ConnectionSelector

**测试验证**:
- ✅ 创建向导显示真实连接列表
- ✅ 在设置页面添加连接后，创建向导立即可见
- ✅ 删除连接后创建向导同步更新

---

### Fix 3: SQL 编辑器支持文件选择 + 修复滚动问题 ✅

**问题描述**:
1. 不支持选择磁盘上的 SQL 文件
2. 输入超长 SQL 后按钮不可见，页面无法滚动

**解决方案**:
1. 添加 `FileButton` 组件支持文件选择（接受 .sql, .txt）
2. 使用 `FileReader` 读取文件内容到编辑器
3. 重写编辑器布局：
   - 使用 flex 布局包含行号和编辑区域
   - 添加 `maxHeight` 限制编辑器高度
   - 行号和编辑区域同步滚动
   - 行号区域独立滚动

**修改文件**:
- `ui/src/components/workflow/SqlEditor.tsx` - 完全重写

**测试验证**:
- ✅ 点击文件夹图标可选择 .sql 文件
- ✅ 文件内容正确加载到编辑器
- ✅ 超长 SQL 时编辑器可滚动
- ✅ 行号与内容同步滚动

---

### Fix 4: 工作流编辑器改为表单模式 ✅

**问题描述**: 编辑工作流时显示原始 JSON，体验不好

**解决方案**:
1. 创建表单模式的编辑器界面：
   - 左侧节点列表（可点击选择）
   - 右侧 `NodeConfigPanel` 配置面板
   - 支持基础/配置/高级三个 Tab
2. 保留 JSON 视图切换按钮
3. 添加删除节点功能

**修改文件**:
- `ui/src/pages/workflows/WorkflowEditor.tsx` - 完全重写
- `ui/src/components/workflow/NodeConfigPanel.tsx` - 新建

**测试验证**:
- ✅ 编辑器显示节点列表
- ✅ 点击节点显示配置面板
- ✅ 可编辑节点配置
- ✅ 可删除非开始/结束节点
- ✅ 可切换到 JSON 视图

---

## 新增组件

### NodeConfigPanel
通用的节点配置面板，支持所有节点类型：
- `file_read`: 文件路径、路径类型
- `sql_transform`: 输入源、方言选择、自定义规则
- `sql_execute`: SQL 来源、连接选择、超时配置
- `condition`: 条件表达式编辑器
- `notify`: Webhook URL、消息模板
- `http`: 请求方法、URL、请求体
- 高级选项: 重试、超时、忽略错误

## 新增 Hook

### useEventSubscription
用于订阅执行进度事件的 hook，支持：
- DBX 原生事件系统
- Mock 模式下的轮询回调

---

## 测试状态

| 测试项 | 状态 |
|--------|------|
| TypeScript 编译 | ✅ 通过 |
| Vite 构建 | ✅ 成功 |
| localStorage 持久化 | ✅ 功能正常 |
| 连接数据集成 | ✅ 功能正常 |
| SQL 文件选择 | ✅ 功能正常 |
| 编辑器滚动 | ✅ 正常 |
| 表单编辑器 | ✅ 功能正常 |

---

## 总结

所有报告的问题已全部修复：
1. ✅ 数据持久化 - localStorage
2. ✅ 连接数据集成 - 真实 API 调用
3. ✅ SQL 文件选择 - FileButton
4. ✅ 编辑器滚动 - flex + maxHeight
5. ✅ 表单编辑器 - NodeConfigPanel
