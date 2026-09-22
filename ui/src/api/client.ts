import type {
  Execution,
  ExecutionSummary,
  ValidationResult,
  Workflow,
  WorkflowInput,
  WorkflowSummary,
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
};
