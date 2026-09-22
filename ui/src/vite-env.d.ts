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
  };
}
