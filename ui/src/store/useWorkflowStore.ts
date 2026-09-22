import { create } from 'zustand';
import { api } from '../api/client';
import type { Workflow, WorkflowInput, WorkflowSummary } from '../api/types';

interface WorkflowState {
  workflows: WorkflowSummary[];
  current: Workflow | null;
  loading: boolean;
  error: string | null;
  fetchWorkflows: () => Promise<void>;
  fetchWorkflow: (id: string) => Promise<void>;
  createWorkflow: (input: WorkflowInput) => Promise<Workflow>;
  updateWorkflow: (id: string, input: Partial<WorkflowInput>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  clearCurrent: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  current: null,
  loading: false,
  error: null,

  fetchWorkflows: async () => {
    set({ loading: true, error: null });
    try {
      const workflows = await api.listWorkflows();
      set({ workflows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchWorkflow: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const current = await api.getWorkflow(id);
      set({ current, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createWorkflow: async (input: WorkflowInput) => {
    set({ loading: true, error: null });
    try {
      const workflow = await api.createWorkflow(input);
      await get().fetchWorkflows();
      set({ loading: false });
      return workflow;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  updateWorkflow: async (id: string, input: Partial<WorkflowInput>) => {
    set({ loading: true, error: null });
    try {
      await api.updateWorkflow(id, input);
      await get().fetchWorkflows();
      set({ loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  deleteWorkflow: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await api.deleteWorkflow(id);
      if (get().current?.id === id) {
        set({ current: null });
      }
      await get().fetchWorkflows();
      set({ loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  clearCurrent: () => set({ current: null }),
}));
