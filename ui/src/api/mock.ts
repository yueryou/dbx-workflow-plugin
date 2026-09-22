import type { Workflow, WorkflowInput, WorkflowSummary, Execution, ExecutionSummary } from './types';

function delay(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mock data store with mutable state inside a closure
export const mockApi = (() => {
  const workflows: Workflow[] = [
    {
      id: 'wf_demo_001',
      name: 'MySQL → PostgreSQL 数据同步',
      version: 2,
      description: '将用户表从 MySQL 同步到 PostgreSQL，包含数据类型转换',
      tags: ['数据同步', 'MySQL', 'PostgreSQL'],
      nodes: [
        { id: 'n1', node_type: 'start', name: '开始', inputs: [], outputs: [{ id: 'o1', label: 'next' }] },
        { id: 'n2', node_type: 'data_source', name: '读取 MySQL', inputs: [{ id: 'i1', label: 'query' }], outputs: [{ id: 'o2', label: 'data' }] },
        { id: 'n3', node_type: 'transform', name: '方言转换', inputs: [{ id: 'i2', label: 'sql' }], outputs: [{ id: 'o3', label: 'converted' }] },
        { id: 'n4', node_type: 'data_source', name: '写入 PostgreSQL', inputs: [{ id: 'i3', label: 'sql' }], outputs: [] },
        { id: 'n5', node_type: 'end', name: '完成', inputs: [], outputs: [] },
      ],
      edges: [
        { id: 'e1', source_node: 'n1', target_node: 'n2' },
        { id: 'e2', source_node: 'n2', target_node: 'n3' },
        { id: 'e3', source_node: 'n3', target_node: 'n4' },
        { id: 'e4', source_node: 'n4', target_node: 'n5' },
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

  const executions: Execution[] = [
    {
      id: 'ex_001',
      workflow_id: 'wf_demo_001',
      workflow_version: 2,
      status: 'completed',
      trigger: 'manual',
      node_results: [
        { node_id: 'n1', status: 'completed', started_at: '2026-09-22T10:00:00Z', finished_at: '2026-09-22T10:00:01Z', output: null, error: null, attempts: 1 },
        { node_id: 'n2', status: 'completed', started_at: '2026-09-22T10:00:01Z', finished_at: '2026-09-22T10:00:05Z', output: { rows: 100 }, error: null, attempts: 1 },
        { node_id: 'n3', status: 'completed', started_at: '2026-09-22T10:00:05Z', finished_at: '2026-09-22T10:00:06Z', output: { converted: true }, error: null, attempts: 1 },
        { node_id: 'n4', status: 'completed', started_at: '2026-09-22T10:00:06Z', finished_at: '2026-09-22T10:00:10Z', output: { affected: 100 }, error: null, attempts: 1 },
        { node_id: 'n5', status: 'completed', started_at: '2026-09-22T10:00:10Z', finished_at: '2026-09-22T10:00:10Z', output: null, error: null, attempts: 1 },
      ],
      started_at: '2026-09-22T10:00:00.000Z',
      finished_at: '2026-09-22T10:00:10.000Z',
      duration_ms: 10000,
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

  return {
    // --- workflow CRUD ---
    listWorkflows: async (): Promise<WorkflowSummary[]> => {
      await delay(200);
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
      const wf = workflows.find((w) => w.id === id);
      if (!wf) throw new Error(`Workflow not found: ${id}`);
      return { ...wf };
    },

    createWorkflow: async (input: WorkflowInput): Promise<Workflow> => {
      await delay(300);
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
      return wf;
    },

    updateWorkflow: async (id: string, input: Partial<WorkflowInput>): Promise<Workflow> => {
      await delay(200);
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
      return { ...wf };
    },

    deleteWorkflow: async (id: string): Promise<{ success: boolean; id: string }> => {
      await delay(200);
      const idx = workflows.findIndex((w) => w.id === id);
      if (idx !== -1) workflows.splice(idx, 1);
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
      let result = executions;
      if (workflowId) result = executions.filter((e) => e.workflow_id === workflowId);
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
      const ex = executions.find((e) => e.id === id);
      if (!ex) throw new Error(`Execution not found: ${id}`);
      return { ...ex };
    },

    createExecution: async (workflowId: string): Promise<Execution> => {
      await delay(300);
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
      return ex;
    },

    cancelExecution: async (id: string): Promise<Execution> => {
      await delay(200);
      const ex = executions.find((e) => e.id === id);
      if (!ex) throw new Error(`Execution not found: ${id}`);
      ex.status = 'canceled';
      ex.finished_at = new Date().toISOString();
      return { ...ex };
    },
  };
})();
