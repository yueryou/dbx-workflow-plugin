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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Subscribe to execution events
   */
  const subscribe = useCallback((executionId: string, onEvent: EventHandler) => {
    const subscription: EventSubscription = { executionId, onEvent };
    subscriptionsRef.current.push(subscription);

    // In real DBX mode, use the event system
    // @ts-expect-error - DBX plugin may have event subscription API at runtime
    if (typeof window !== 'undefined' && window.dbxPlugin?.on) {
      const handleEvent = (event: ExecutionEvent) => {
        if (event.executionId === executionId) {
          onEvent(event);
        }
      };

      // @ts-expect-error - DBX plugin may have event subscription API at runtime
      window.dbxPlugin.on('execution/nodeStarted', handleEvent as any);
      // @ts-expect-error - DBX plugin may have event subscription API at runtime
      window.dbxPlugin.on('execution/nodeCompleted', handleEvent as any);
      // @ts-expect-error - DBX plugin may have event subscription API at runtime
      window.dbxPlugin.on('execution/nodeFailed', handleEvent as any);
      // @ts-expect-error - DBX plugin may have event subscription API at runtime
      window.dbxPlugin.on('execution/completed', handleEvent as any);
      // @ts-expect-error - DBX plugin may have event subscription API at runtime
      window.dbxPlugin.on('execution/failed', handleEvent as any);
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
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return { subscribe, unsubscribe, notify };
}
