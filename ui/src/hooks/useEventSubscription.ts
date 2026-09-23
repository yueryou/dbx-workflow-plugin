import { useEffect, useCallback, useRef } from 'react';
import type { ExecutionEvent } from '../api/types';

type EventHandler = (event: ExecutionEvent) => void;

interface EventSubscription {
  executionId: string;
  onEvent: EventHandler;
}

/**
 * Hook for subscribing to DBX plugin events for execution progress.
 * Falls back to polling in mock mode.
 */
export function useEventSubscription() {
  const subscriptionsRef = useRef<EventSubscription[]>([]);

  /**
   * Subscribe to execution events
   */
  const subscribe = useCallback((executionId: string, onEvent: EventHandler) => {
    const subscription: EventSubscription = { executionId, onEvent };
    subscriptionsRef.current.push(subscription);

    // In real DBX mode, use the event system
    if (typeof window !== 'undefined' && window.dbxPlugin?.onEvent) {
      const handleEvent = (event: { method: string; params: unknown }) => {
        const params = event.params as ExecutionEvent;
        if (params.executionId === executionId) {
          onEvent(params);
        }
      };

      window.dbxPlugin.onEvent(handleEvent);
    }

    return () => {
      subscriptionsRef.current = subscriptionsRef.current.filter((s) => s !== subscription);
    };
  }, []);

  /**
   * Unsubscribe from execution events
   */
  const unsubscribe = useCallback((executionId: string) => {
    subscriptionsRef.current = subscriptionsRef.current.filter((s) => s.executionId !== executionId);
  }, []);

  /**
   * Notify subscribers of an event (used in mock mode)
   */
  const notify = useCallback((event: ExecutionEvent) => {
    subscriptionsRef.current
      .filter((s) => s.executionId === event.executionId)
      .forEach((s) => s.onEvent(event));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      subscriptionsRef.current = [];
    };
  }, []);

  return { subscribe, unsubscribe, notify };
}
