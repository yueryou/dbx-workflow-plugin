import { useEffect } from 'react';
import { useExecutionStore } from '../store/useExecutionStore';

/**
 * Hook for polling execution status.
 * Automatically starts polling when executionId is provided and stops on unmount.
 */
export function useExecutionPolling(executionId: string | null, intervalMs = 2000) {
  const { polling, startPolling, stopPolling } = useExecutionStore();

  useEffect(() => {
    if (executionId) {
      startPolling(executionId);
      return () => stopPolling();
    }
  }, [executionId, intervalMs]);

  return { polling };
}
