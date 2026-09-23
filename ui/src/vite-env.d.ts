/// <reference types="vite/client" />

interface Window {
  dbxPlugin: {
    ready: Promise<void>;
    locale: string;
    context?: {
      connectionId?: string;
      [key: string]: unknown;
    };
    invoke(method: string, params?: unknown): Promise<unknown>;
    onEvent: (callback: (event: { method: string; params: unknown }) => void) => void;
    onContext: (callback: (context: unknown) => void) => void;
    onInit: (callback: () => void) => void;
  };
}
