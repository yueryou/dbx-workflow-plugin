import type {
  Workflow,
  WorkflowInput,
  WorkflowSummary,
  Execution,
  ExecutionSummary,
  CustomRule,
  Dialect,
  SqlTransformResult,
  NotifyConfig,
  Schedule,
  ScheduleInput,
  DbConnection,
  DbConnectionInput,
  ConnectionTestResult,
  ExecutionLogs,
  ExecutionLogItem,
} from './types';

function delay(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// localStorage 持久化层
// ============================================================

const STORAGE_KEYS = {
  workflows: 'dbx_workflow_workflows',
  executions: 'dbx_workflow_executions',
  connections: 'dbx_workflow_connections',
  schedules: 'dbx_workflow_schedules',
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage:`, e);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage:`, e);
  }
}

// 初始化默认数据
const defaultWorkflows: Workflow[] = [
  {
    id: 'wf_demo_001',
    name: 'MySQL → PostgreSQL 数据同步',
    version: 2,
    description: '将用户表从 MySQL 同步到 PostgreSQL，包含数据类型转换',
    tags: ['数据同步', 'MySQL', 'PostgreSQL'],
    nodes: [
      { id: 'n1', node_type: 'start', name: '开始', inputs: [], outputs: [{ id: 'o1', label: 'next' }] },
      {
        id: 'n2', node_type: 'file_read', name: '读取 SQL 文件',
        config: { path: './queries/users_sync.sql' },
        inputs: [], outputs: [{ id: 'o2', label: 'content' }]
      },
      {
        id: 'n3', node_type: 'sql_transform', name: 'MySQL → PostgreSQL 转换',
        config: { inputNode: 'n2', sourceDialect: 'mysql', targetDialect: 'postgresql', customRules: [
          { name: 'Remove comments', pattern: '--.*$', replacement: '', enabled: true }
        ]},
        inputs: [{ id: 'i2', label: 'sql' }], outputs: [{ id: 'o3', label: 'converted' }]
      },
      {
        id: 'n4', node_type: 'sql_execute', name: '执行到 PostgreSQL',
        config: { inputNode: 'n3', connectionId: 'conn_pg_001', timeoutSeconds: 30 },
        inputs: [{ id: 'i3', label: 'sql' }], outputs: [{ id: 'o4', label: 'result' }]
      },
      {
        id: 'n5', node_type: 'notify', name: '发送通知',
        config: { type: 'webhook', webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx', message: '数据同步完成' },
        inputs: [{ id: 'i4', label: 'trigger' }], outputs: []
      },
      { id: 'n6', node_type: 'end', name: '完成', inputs: [], outputs: [] },
    ],
    edges: [
      { id: 'e1', source_node: 'n1', target_node: 'n2' },
      { id: 'e2', source_node: 'n2', target_node: 'n3' },
      { id: 'e3', source_node: 'n3', target_node: 'n4' },
      { id: 'e4', source_node: 'n4', target_node: 'n5' },
      { id: 'e5', source_node: 'n5', target_node: 'n6' },
    ],
    created_at: '2026-09-20T10:00:00.000Z',
    updated_at: '2026-09-22T14:30:00.000Z',
  },
  {
    id: 'wf_demo_002',
    name: '每日定时备份',
    version: 1,
    description: '每天凌晨2点自动备份指定数据库表',
    tags: ['定时', '备份'],
    nodes: [
      { id: 'n1', node_type: 'start', name: '触发', inputs: [], outputs: [{ id: 'o1', label: 'next' }] },
      { id: 'n2', node_type: 'script', name: '执行备份脚本', inputs: [{ id: 'i1', label: 'config' }], outputs: [{ id: 'o2', label: 'result' }] },
      { id: 'n3', node_type: 'end', name: '完成', inputs: [], outputs: [] },
    ],
    edges: [
      { id: 'e1', source_node: 'n1', target_node: 'n2' },
      { id: 'e2', source_node: 'n2', target_node: 'n3' },
    ],
    created_at: '2026-09-18T08:00:00.000Z',
    updated_at: '2026-09-21T16:00:00.000Z',
  },
];

const defaultConnections: DbConnection[] = [
  {
    id: 'conn_mysql_001',
    name: '本地 MySQL',
    driver: 'mysql',
    host: 'localhost',
    port: 3306,
    database: 'source_db',
    username: 'root',
    status: 'connected',
    createdAt: '2026-09-15T08:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
  },
  {
    id: 'conn_pg_001',
    name: '生产 PostgreSQL',
    driver: 'postgresql',
    host: '192.168.1.100',
    port: 5432,
    database: 'target_db',
    username: 'admin',
    status: 'connected',
    createdAt: '2026-09-16T09:00:00.000Z',
    updatedAt: '2026-09-21T14:00:00.000Z',
  },
];

const defaultExecutions: Execution[] = [
  {
    id: 'ex_001',
    workflow_id: 'wf_demo_001',
    workflow_version: 2,
    status: 'completed',
    trigger: 'manual',
    node_results: [
      { node_id: 'n1', status: 'completed', started_at: '2026-09-22T10:00:00Z', finished_at: '2026-09-22T10:00:01Z', output: null, error: null, attempts: 1 },
      { node_id: 'n2', status: 'completed', started_at: '2026-09-22T10:00:01Z', finished_at: '2026-09-22T10:00:05Z', output: { path: './queries/users_sync.sql', size: 256 }, error: null, attempts: 1 },
      { node_id: 'n3', status: 'completed', started_at: '2026-09-22T10:00:05Z', finished_at: '2026-09-22T10:00:06Z', output: { appliedRules: 5 }, error: null, attempts: 1 },
      { node_id: 'n4', status: 'completed', started_at: '2026-09-22T10:00:06Z', finished_at: '2026-09-22T10:00:10Z', output: { affectedRows: 100, executionTimeMs: 50 }, error: null, attempts: 1 },
      { node_id: 'n5', status: 'completed', started_at: '2026-09-22T10:00:10Z', finished_at: '2026-09-22T10:00:11Z', output: { type: 'webhook', status: 'sent' }, error: null, attempts: 1 },
      { node_id: 'n6', status: 'completed', started_at: '2026-09-22T10:00:11Z', finished_at: '2026-09-22T10:00:11Z', output: null, error: null, attempts: 1 },
    ],
    started_at: '2026-09-22T10:00:00.000Z',
    finished_at: '2026-09-22T10:00:11.000Z',
    duration_ms: 11000,
  },
  {
    id: 'ex_002',
    workflow_id: 'wf_demo_002',
    workflow_version: 1,
    status: 'failed',
    trigger: 'schedule',
    node_results: [
      { node_id: 'n1', status: 'completed', started_at: '2026-09-22T02:00:00Z', finished_at: '2026-09-22T02:00:01Z', output: null, error: null, attempts: 1 },
      { node_id: 'n2', status: 'failed', started_at: '2026-09-22T02:00:01Z', finished_at: '2026-09-22T02:00:05Z', output: null, error: 'Connection timeout', attempts: 3 },
    ],
    error: 'Connection timeout on step 2',
    started_at: '2026-09-22T02:00:00.000Z',
    finished_at: '2026-09-22T02:00:05.000Z',
    duration_ms: 5000,
  },
];

// 初始化：如果 localStorage 没有数据，使用默认值
function initStorage(): { workflows: Workflow[]; executions: Execution[]; connections: DbConnection[]; schedules: Schedule[] } {
  const workflows = loadFromStorage<Workflow[]>(STORAGE_KEYS.workflows, []);
  const executions = loadFromStorage<Execution[]>(STORAGE_KEYS.executions, []);
  const connections = loadFromStorage<DbConnection[]>(STORAGE_KEYS.connections, []);
  const schedules = loadFromStorage<Schedule[]>(STORAGE_KEYS.schedules, []);

  // 首次加载：如果为空，填充默认值
  if (workflows.length === 0) {
    saveToStorage(STORAGE_KEYS.workflows, defaultWorkflows);
  }
  if (connections.length === 0) {
    saveToStorage(STORAGE_KEYS.connections, defaultConnections);
  }
  if (executions.length === 0) {
    saveToStorage(STORAGE_KEYS.executions, defaultExecutions);
  }

  return {
    workflows: workflows.length > 0 ? workflows : defaultWorkflows,
    executions: executions.length > 0 ? executions : defaultExecutions,
    connections: connections.length > 0 ? connections : defaultConnections,
    schedules,
  };
}

// ============================================================
// Mock API 实现
// ============================================================

export const mockApi = (() => {
  // 初始化存储
  const data = initStorage();

  return {
    // --- workflow CRUD ---
    listWorkflows: async (): Promise<WorkflowSummary[]> => {
      await delay(200);
      const workflows = loadFromStorage<Workflow[]>(STORAGE_KEYS.workflows, data.workflows);
      return workflows.map((w) => ({
        id: w.id,
        name: w.name,
        version: w.version,
        tags: w.tags,
        updated_at: w.updated_at,
        node_count: w.nodes.length,
      }));
    },

    getWorkflow: async (id: string): Promise<Workflow> => {
      await delay(150);
      const workflows = loadFromStorage<Workflow[]>(STORAGE_KEYS.workflows, data.workflows);
      const wf = workflows.find((w) => w.id === id);
      if (!wf) throw new Error(`Workflow not found: ${id}`);
      return { ...wf };
    },

    createWorkflow: async (input: WorkflowInput): Promise<Workflow> => {
      await delay(300);
      const workflows = loadFromStorage<Workflow[]>(STORAGE_KEYS.workflows, data.workflows);
      const now = new Date().toISOString();
      const wf: Workflow = {
        id: `wf_${Date.now().toString(36)}`,
        version: 1,
        name: input.name,
        description: input.description,
        tags: input.tags || [],
        nodes: input.nodes || [],
        edges: input.edges || [],
        created_at: now,
        updated_at: now,
      };
      workflows.unshift(wf);
      saveToStorage(STORAGE_KEYS.workflows, workflows);
      return wf;
    },

    updateWorkflow: async (id: string, input: Partial<WorkflowInput>): Promise<Workflow> => {
      await delay(200);
      const workflows = loadFromStorage<Workflow[]>(STORAGE_KEYS.workflows, data.workflows);
      const idx = workflows.findIndex((w) => w.id === id);
      if (idx === -1) throw new Error(`Workflow not found: ${id}`);
      const wf = workflows[idx];
      if (input.name) wf.name = input.name;
      if (input.description !== undefined) wf.description = input.description;
      if (input.tags) wf.tags = input.tags;
      if (input.nodes) wf.nodes = input.nodes;
      if (input.edges) wf.edges = input.edges;
      wf.version += 1;
      wf.updated_at = new Date().toISOString();
      saveToStorage(STORAGE_KEYS.workflows, workflows);
      return { ...wf };
    },

    deleteWorkflow: async (id: string): Promise<{ success: boolean; id: string }> => {
      await delay(200);
      const workflows = loadFromStorage<Workflow[]>(STORAGE_KEYS.workflows, data.workflows);
      const idx = workflows.findIndex((w) => w.id === id);
      if (idx !== -1) workflows.splice(idx, 1);
      saveToStorage(STORAGE_KEYS.workflows, workflows);
      return { success: true, id };
    },

    validateWorkflow: async (
      input: WorkflowInput,
    ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> => {
      await delay(100);
      const errors: string[] = [];
      const warnings: string[] = [];
      const nodes = input.nodes || [];
      const has_start = nodes.some((n) => n.node_type === 'start');
      const has_end = nodes.some((n) => n.node_type === 'end');
      if (!has_start) errors.push('Missing Start node');
      if (!has_end) errors.push('Missing End node');
      return { valid: errors.length === 0, errors, warnings };
    },

    // --- execution CRUD ---
    listExecutions: async (workflowId?: string): Promise<ExecutionSummary[]> => {
      await delay(200);
      let result = loadFromStorage<Execution[]>(STORAGE_KEYS.executions, data.executions);
      if (workflowId) result = result.filter((e) => e.workflow_id === workflowId);
      return result.map((e) => ({
        id: e.id,
        workflow_id: e.workflow_id,
        status: e.status,
        started_at: e.started_at,
        finished_at: e.finished_at,
      }));
    },

    getExecution: async (id: string): Promise<Execution> => {
      await delay(150);
      const executions = loadFromStorage<Execution[]>(STORAGE_KEYS.executions, data.executions);
      const ex = executions.find((e) => e.id === id);
      if (!ex) throw new Error(`Execution not found: ${id}`);
      return { ...ex };
    },

    createExecution: async (workflowId: string): Promise<Execution> => {
      await delay(300);
      const executions = loadFromStorage<Execution[]>(STORAGE_KEYS.executions, data.executions);
      const ex: Execution = {
        id: `ex_${Date.now().toString(36)}`,
        workflow_id: workflowId,
        workflow_version: 1,
        status: 'pending',
        trigger: 'manual',
        node_results: [],
        started_at: new Date().toISOString(),
        finished_at: null,
        duration_ms: 0,
      };
      executions.unshift(ex);
      saveToStorage(STORAGE_KEYS.executions, executions);
      return ex;
    },

    cancelExecution: async (id: string): Promise<Execution> => {
      await delay(200);
      const executions = loadFromStorage<Execution[]>(STORAGE_KEYS.executions, data.executions);
      const ex = executions.find((e) => e.id === id);
      if (!ex) throw new Error(`Execution not found: ${id}`);
      ex.status = 'canceled';
      ex.finished_at = new Date().toISOString();
      saveToStorage(STORAGE_KEYS.executions, executions);
      return { ...ex };
    },

    // === M2: New mock methods ===

    runExecution: async (workflowId: string): Promise<{ executionId: string; status: string }> => {
      await delay(200);
      const executions = loadFromStorage<Execution[]>(STORAGE_KEYS.executions, data.executions);
      const workflows = loadFromStorage<Workflow[]>(STORAGE_KEYS.workflows, data.workflows);
      const workflow = workflows.find((w) => w.id === workflowId);

      const executionId = `ex_${Date.now().toString(36)}`;
      const ex: Execution = {
        id: executionId,
        workflow_id: workflowId,
        workflow_version: 1,
        status: 'running',
        trigger: 'manual',
        node_results: [],
        started_at: new Date().toISOString(),
        finished_at: null,
        duration_ms: 0,
      };
      executions.unshift(ex);
      saveToStorage(STORAGE_KEYS.executions, executions);

      // 模拟逐步执行每个节点
      let nodeIndex = 0;
      const nodes = workflow?.nodes || [];

      const executeNextNode = () => {
        if (nodeIndex >= nodes.length) {
          // 所有节点执行完成
          const currentExecs = loadFromStorage<Execution[]>(STORAGE_KEYS.executions, data.executions);
          const exec = currentExecs.find((e) => e.id === executionId);
          if (exec) {
            exec.status = 'completed';
            exec.finished_at = new Date().toISOString();
            exec.duration_ms = (exec.finished_at && exec.started_at)
              ? new Date(exec.finished_at).getTime() - new Date(exec.started_at).getTime()
              : 0;
            saveToStorage(STORAGE_KEYS.executions, currentExecs);
          }
          return;
        }

        const node = nodes[nodeIndex];
        // 跳过 start/end 虚拟节点，但仍记录
        const isVirtual = node.node_type === 'start' || node.node_type === 'end';
        const nodeResult = {
          node_id: node.id,
          status: isVirtual ? 'completed' as const : (Math.random() > 0.05 ? 'completed' as const : 'failed' as const),
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          output: isVirtual ? null : { simulated: true, nodeType: node.node_type },
          error: null,
          attempts: 1,
        };

        // 更新执行记录
        const currentExecs = loadFromStorage<Execution[]>(STORAGE_KEYS.executions, data.executions);
        const exec = currentExecs.find((e) => e.id === executionId);
        if (exec) {
          exec.node_results.push(nodeResult);
          saveToStorage(STORAGE_KEYS.executions, currentExecs);
        }

        nodeIndex++;
        // 每个节点 1-2.5 秒
        setTimeout(executeNextNode, 1000 + Math.random() * 1500);
      };

      // 开始执行第一个节点
      setTimeout(executeNextNode, 500);

      return { executionId, status: 'running' };
    },

    transformSql: async (params: {
      sql: string;
      sourceDialect: string;
      targetDialect: string;
      customRules?: CustomRule[];
    }): Promise<SqlTransformResult> => {
      await delay(200);
      let result = params.sql;
      // Simple mock transformations
      if (params.sourceDialect === 'mysql' && params.targetDialect === 'postgresql') {
        result = result.replace(/`([^`]+)`/g, '"$1"');
        result = result.replace(/IFNULL\(/gi, 'COALESCE(');
        result = result.replace(/AUTO_INCREMENT/gi, 'SERIAL');
      }
      // Apply custom rules
      if (params.customRules) {
        for (const rule of params.customRules) {
          if (rule.enabled && rule.pattern) {
            try {
              const re = new RegExp(rule.pattern, 'g');
              result = result.replace(re, rule.replacement);
            } catch {
              // ignore invalid regex
            }
          }
        }
      }
      return {
        sql: result,
        sourceDialect: params.sourceDialect,
        targetDialect: params.targetDialect,
      };
    },

    listDialects: async (): Promise<Dialect[]> => {
      await delay(100);
      return [
        { id: 'mysql', name: 'MySQL / MariaDB' },
        { id: 'postgresql', name: 'PostgreSQL' },
        { id: 'sqlite', name: 'SQLite' },
        { id: 'mssql', name: 'Microsoft SQL Server' },
        { id: 'oracle', name: 'Oracle Database' },
      ];
    },

    testNotification: async (_config: NotifyConfig): Promise<{ success: boolean; error?: string }> => {
      await delay(500);
      return { success: true };
    },

    listSchedules: async (): Promise<Schedule[]> => {
      await delay(150);
      return loadFromStorage<Schedule[]>(STORAGE_KEYS.schedules, []);
    },

    createSchedule: async (input: ScheduleInput): Promise<Schedule> => {
      await delay(200);
      const schedules = loadFromStorage<Schedule[]>(STORAGE_KEYS.schedules, []);
      const schedule: Schedule = {
        id: `sch_${Date.now().toString(36)}`,
        workflow_id: input.workflow_id,
        cron_expression: input.cron_expression,
        enabled: input.enabled ?? true,
        last_triggered_at: undefined,
        next_trigger_at: undefined,
      };
      schedules.push(schedule);
      saveToStorage(STORAGE_KEYS.schedules, schedules);
      return schedule;
    },

    deleteSchedule: async (id: string): Promise<{ success: boolean }> => {
      await delay(150);
      const schedules = loadFromStorage<Schedule[]>(STORAGE_KEYS.schedules, []);
      const idx = schedules.findIndex((s) => s.id === id);
      if (idx !== -1) schedules.splice(idx, 1);
      saveToStorage(STORAGE_KEYS.schedules, schedules);
      return { success: true };
    },

    // === M3: Connection management ===

    listConnections: async (): Promise<DbConnection[]> => {
      await delay(150);
      const connections = loadFromStorage<DbConnection[]>(STORAGE_KEYS.connections, data.connections);
      // Return connections without passwords
      return connections.map((c) => ({ ...c, password: undefined }));
    },

    createConnection: async (input: DbConnectionInput): Promise<DbConnection> => {
      await delay(200);
      const connections = loadFromStorage<DbConnection[]>(STORAGE_KEYS.connections, data.connections);
      const conn: DbConnection = {
        id: `conn_${Date.now().toString(36)}`,
        ...input,
        status: 'disconnected',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      connections.push(conn);
      saveToStorage(STORAGE_KEYS.connections, connections);
      return { ...conn, password: undefined };
    },

    updateConnection: async (id: string, input: Partial<DbConnectionInput>): Promise<DbConnection> => {
      await delay(200);
      const connections = loadFromStorage<DbConnection[]>(STORAGE_KEYS.connections, data.connections);
      const idx = connections.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error(`Connection not found: ${id}`);
      Object.assign(connections[idx], input, { updatedAt: new Date().toISOString() });
      saveToStorage(STORAGE_KEYS.connections, connections);
      return { ...connections[idx], password: undefined };
    },

    deleteConnection: async (id: string): Promise<{ success: boolean; id: string }> => {
      await delay(150);
      const connections = loadFromStorage<DbConnection[]>(STORAGE_KEYS.connections, data.connections);
      const idx = connections.findIndex((c) => c.id === id);
      if (idx !== -1) connections.splice(idx, 1);
      saveToStorage(STORAGE_KEYS.connections, connections);
      return { success: true, id };
    },

    testConnection: async (_input: DbConnectionInput): Promise<ConnectionTestResult> => {
      await delay(800);
      return { success: true, message: '连接成功！数据库响应正常。' };
    },

    // === M3: Execution logs ===

    getExecutionLogs: async (executionId: string): Promise<ExecutionLogs> => {
      await delay(200);
      const executions = loadFromStorage<Execution[]>(STORAGE_KEYS.executions, data.executions);
      const ex = executions.find((e) => e.id === executionId);
      if (!ex) throw new Error(`Execution not found: ${executionId}`);

      const logs: ExecutionLogItem[] = ex.node_results.map((nr) => {
        const duration = nr.started_at && nr.finished_at
          ? new Date(nr.finished_at).getTime() - new Date(nr.started_at).getTime()
          : 0;
        return {
          nodeId: nr.node_id,
          status: nr.status,
          startedAt: nr.started_at,
          finishedAt: nr.finished_at,
          durationMs: duration,
          output: nr.output,
          error: nr.error ?? undefined,
          attempts: nr.attempts,
        };
      });

      return {
        executionId: ex.id,
        workflowId: ex.workflow_id,
        status: ex.status,
        startedAt: ex.started_at,
        finishedAt: ex.finished_at ?? undefined,
        logs,
      };
    },

    // === 工具方法 ===

    /** 清除所有数据（用于测试） */
    _clearAll: (): void => {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    },

    /** 重置为默认数据 */
    _resetToDefaults: (): void => {
      saveToStorage(STORAGE_KEYS.workflows, defaultWorkflows);
      saveToStorage(STORAGE_KEYS.connections, defaultConnections);
      saveToStorage(STORAGE_KEYS.executions, defaultExecutions);
      saveToStorage(STORAGE_KEYS.schedules, []);
    },
  };
})();
