import { create } from 'zustand';
import { api } from '../api/client';
import type { Execution, ExecutionSummary } from '../api/types';

interface ExecutionState {
  executions: ExecutionSummary[];
  current: Execution | null;
  loading: boolean;
  error: string | null;
  fetchExecutions: (workflowId?: string) => Promise<void>;
  fetchExecution: (id: string) => Promise<void>;
  createExecution: (workflowId: string) => Promise<Execution>;
  cancelExecution: (id: string) => Promise<void>;
  clearCurrent: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  executions: [],
  current: null,
  loading: false,
  error: null,

  fetchExecutions: async (workflowId?: string) => {
    set({ loading: true, error: null });
    try {
      const executions = await api.listExecutions(workflowId);
      set({ executions, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchExecution: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const current = await api.getExecution(id);
      set({ current, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createExecution: async (workflowId: string) => {
    set({ loading: true, error: null });
    try {
      const execution = await api.createExecution(workflowId);
      await get().fetchExecutions();
      set({ loading: false });
      return execution;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  cancelExecution: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await api.cancelExecution(id);
      await get().fetchExecutions();
      set({ loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  clearCurrent: () => set({ current: null }),
}));
