import { create } from 'zustand';
import { api } from '../api/client';
import type { Execution, ExecutionSummary } from '../api/types';

// 节点执行状态
export interface NodeStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  output?: unknown;
  error?: string;
  progress?: number;
}

// 日志条目
export interface LogEntry {
  timestamp: string;
  nodeId: string;
  nodeName?: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

interface ExecutionState {
  // 现有：执行历史列表
  executions: ExecutionSummary[];
  current: Execution | null;
  loading: boolean;
  error: string | null;

  // 新增：实时执行状态
  activeExecutionId: string | null;
  nodeStatuses: Record<string, NodeStatus>;
  logs: LogEntry[];
  polling: boolean;
  pollInterval: number;

  // 现有 Actions
  fetchExecutions: (workflowId?: string) => Promise<void>;
  fetchExecution: (id: string) => Promise<void>;
  createExecution: (workflowId: string) => Promise<Execution>;
  cancelExecution: (id: string) => Promise<void>;
  clearCurrent: () => void;

  // 新增 Actions
  runExecution: (workflowId: string) => Promise<string>;
  startPolling: (executionId: string) => void;
  stopPolling: () => void;
  appendLog: (log: LogEntry) => void;
  updateNodeStatus: (nodeId: string, status: Partial<NodeStatus>) => void;
  clearActive: () => void;
  loadExecutionProgress: (executionId: string) => Promise<void>;
}

// 轮询定时器
let pollTimer: ReturnType<typeof setInterval> | null = null;

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  // 初始状态
  executions: [],
  current: null,
  loading: false,
  error: null,
  activeExecutionId: null,
  nodeStatuses: {},
  logs: [],
  polling: false,
  pollInterval: 2000,

  // 现有 Actions
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

  // 新增 Actions
  runExecution: async (workflowId: string) => {
    set({ loading: true, error: null });
    try {
      const result = await api.runExecution(workflowId);
      set({ loading: false });
      // 初始化实时状态
      set({
        activeExecutionId: result.executionId,
        nodeStatuses: {},
        logs: [],
      });
      return result.executionId;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  startPolling: (executionId: string) => {
    // 清除现有定时器
    if (pollTimer) {
      clearInterval(pollTimer);
    }

    set({ polling: true, activeExecutionId: executionId });

    // 立即获取一次
    get().loadExecutionProgress(executionId);

    // 开始轮询
    pollTimer = setInterval(async () => {
      await get().loadExecutionProgress(executionId);
      // 检查是否完成
      const state = get();
      const allDone = Object.values(state.nodeStatuses).every(
        (s) => ['completed', 'failed', 'skipped'].includes(s.status)
      );
      if (allDone) {
        get().stopPolling();
      }
    }, get().pollInterval);
  },

  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    set({ polling: false });
  },

  appendLog: (log: LogEntry) => {
    set((state) => ({ logs: [...state.logs, log] }));
  },

  updateNodeStatus: (nodeId: string, status: Partial<NodeStatus>) => {
    set((state) => ({
      nodeStatuses: {
        ...state.nodeStatuses,
        [nodeId]: { ...state.nodeStatuses[nodeId], ...status },
      },
    }));
  },

  clearActive: () => {
    set({
      activeExecutionId: null,
      nodeStatuses: {},
      logs: [],
      polling: false,
    });
  },

  loadExecutionProgress: async (executionId: string) => {
    try {
      const progress = await api.getExecutionLogs(executionId);

      // 更新节点状态
      const nodeStatuses: Record<string, NodeStatus> = {};
      const logs: LogEntry[] = [];

      for (const log of progress.logs) {
        nodeStatuses[log.nodeId] = {
          status: log.status as NodeStatus['status'],
          startedAt: log.startedAt,
          finishedAt: log.finishedAt,
          durationMs: log.durationMs,
          output: log.output,
          error: log.error,
        };

        // 生成日志条目
        logs.push({
          timestamp: log.startedAt || new Date().toISOString(),
          nodeId: log.nodeId,
          level: log.status === 'completed' ? 'success' : log.status === 'failed' ? 'error' : 'info',
          message: `节点 ${log.nodeId} ${log.status}`,
        });
      }

      set({ nodeStatuses, logs, current: progress as any });
    } catch (e) {
      console.error('Failed to load execution progress:', e);
    }
  },
}));
