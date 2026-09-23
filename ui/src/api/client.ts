import type {
  CustomRule,
  Dialect,
  Execution,
  ExecutionSummary,
  NotifyConfig,
  Schedule,
  ScheduleInput,
  SqlTransformResult,
  ValidationResult,
  Workflow,
  WorkflowInput,
  WorkflowSummary,
  DbConnection,
  DbConnectionInput,
  ConnectionTestResult,
  ExecutionLogs,
} from './types';
import { mockApi } from './mock';

// Detect if running inside DBX (real bridge) or standalone (dev/preview)
const hasBridge = typeof window !== 'undefined' && window.dbxPlugin != null;

function invoke(method: string, params?: unknown): Promise<unknown> {
  if (!window.dbxPlugin) {
    throw new Error('DBX Plugin bridge not available');
  }
  return window.dbxPlugin.invoke(method, params);
}

export const api = {
  // Flag to indicate which mode we're running in
  isMockMode: !hasBridge,

  // --- workflow CRUD ---
  listWorkflows: async (): Promise<WorkflowSummary[]> => {
    if (!hasBridge) return mockApi.listWorkflows();
    return invoke('workflow/list', {}) as Promise<WorkflowSummary[]>;
  },

  getWorkflow: async (id: string): Promise<Workflow> => {
    if (!hasBridge) return mockApi.getWorkflow(id);
    return invoke('workflow/get', { id }) as Promise<Workflow>;
  },

  createWorkflow: async (input: WorkflowInput): Promise<Workflow> => {
    if (!hasBridge) return mockApi.createWorkflow(input);
    return invoke('workflow/create', { input }) as Promise<Workflow>;
  },

  updateWorkflow: async (id: string, input: Partial<WorkflowInput>): Promise<Workflow> => {
    if (!hasBridge) return mockApi.updateWorkflow(id, input);
    return invoke('workflow/update', { id, input }) as Promise<Workflow>;
  },

  deleteWorkflow: async (id: string): Promise<{ success: boolean; id: string }> => {
    if (!hasBridge) return mockApi.deleteWorkflow(id);
    return invoke('workflow/delete', { id }) as Promise<{ success: boolean; id: string }>;
  },

  validateWorkflow: async (input: WorkflowInput): Promise<ValidationResult> => {
    if (!hasBridge) return mockApi.validateWorkflow(input);
    return invoke('workflow/validate', { input }) as Promise<ValidationResult>;
  },

  // --- execution CRUD ---
  listExecutions: async (workflowId?: string): Promise<ExecutionSummary[]> => {
    if (!hasBridge) return mockApi.listExecutions(workflowId);
    return invoke('execution/list', workflowId ? { workflowId } : {}) as Promise<
      ExecutionSummary[]
    >;
  },

  getExecution: async (id: string): Promise<Execution> => {
    if (!hasBridge) return mockApi.getExecution(id);
    return invoke('execution/get', { id }) as Promise<Execution>;
  },

  createExecution: async (workflowId: string): Promise<Execution> => {
    if (!hasBridge) return mockApi.createExecution(workflowId);
    return invoke('execution/create', { workflowId }) as Promise<Execution>;
  },

  cancelExecution: async (id: string): Promise<Execution> => {
    if (!hasBridge) return mockApi.cancelExecution(id);
    return invoke('execution/cancel', { id }) as Promise<Execution>;
  },

  // === M2: New API methods ===

  // Run workflow execution
  runExecution: async (workflowId: string): Promise<{ executionId: string; status: string }> => {
    if (!hasBridge) return mockApi.runExecution(workflowId);
    return invoke('execution/run', { workflowId }) as Promise<{
      executionId: string;
      status: string;
    }>;
  },

  // SQL transform
  transformSql: async (params: {
    sql: string;
    sourceDialect: string;
    targetDialect: string;
    customRules?: CustomRule[];
  }): Promise<SqlTransformResult> => {
    if (!hasBridge) return mockApi.transformSql(params);
    return invoke('transform/sql', params) as Promise<SqlTransformResult>;
  },

  // List supported dialects
  listDialects: async (): Promise<Dialect[]> => {
    if (!hasBridge) return mockApi.listDialects();
    return invoke('transform/dialects', {}) as Promise<Dialect[]>;
  },

  // Test notification
  testNotification: async (config: NotifyConfig): Promise<{ success: boolean; error?: string }> => {
    if (!hasBridge) return mockApi.testNotification(config);
    return invoke('notify/test', { config }) as Promise<{ success: boolean; error?: string }>;
  },

  // --- Schedule management ---
  listSchedules: async (): Promise<Schedule[]> => {
    if (!hasBridge) return mockApi.listSchedules();
    return invoke('schedule/list', {}) as Promise<Schedule[]>;
  },

  createSchedule: async (input: ScheduleInput): Promise<Schedule> => {
    if (!hasBridge) return mockApi.createSchedule(input);
    return invoke('schedule/create', { input }) as Promise<Schedule>;
  },

  deleteSchedule: async (id: string): Promise<{ success: boolean }> => {
    if (!hasBridge) return mockApi.deleteSchedule(id);
    return invoke('schedule/delete', { id }) as Promise<{ success: boolean }>;
  },

  // === M3: Connection management ===

  listConnections: async (): Promise<DbConnection[]> => {
    if (!hasBridge) return mockApi.listConnections();
    return invoke('connection/list', {}) as Promise<DbConnection[]>;
  },

  createConnection: async (input: DbConnectionInput): Promise<DbConnection> => {
    if (!hasBridge) return mockApi.createConnection(input);
    return invoke('connection/create', input) as Promise<DbConnection>;
  },

  updateConnection: async (id: string, input: Partial<DbConnectionInput>): Promise<DbConnection> => {
    if (!hasBridge) return mockApi.updateConnection(id, input);
    return invoke('connection/update', { id, ...input }) as Promise<DbConnection>;
  },

  deleteConnection: async (id: string): Promise<{ success: boolean; id: string }> => {
    if (!hasBridge) return mockApi.deleteConnection(id);
    return invoke('connection/delete', { id }) as Promise<{ success: boolean; id: string }>;
  },

  testConnection: async (input: DbConnectionInput): Promise<ConnectionTestResult> => {
    if (!hasBridge) return mockApi.testConnection(input);
    return invoke('connection/test', input) as Promise<ConnectionTestResult>;
  },

  // === M3: Execution logs ===

  getExecutionLogs: async (executionId: string): Promise<ExecutionLogs> => {
    if (!hasBridge) return mockApi.getExecutionLogs(executionId);
    return invoke('execution/logs', { id: executionId }) as Promise<ExecutionLogs>;
  },
};
