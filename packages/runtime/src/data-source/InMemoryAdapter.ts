import type { DataSourceAdapter } from './DataSourceAdapter';

type TopicHandler = (payload: unknown) => void;

export class InMemoryAdapter implements DataSourceAdapter {
  private readonly data: Record<string, unknown>;
  private readonly listeners = new Map<string, Set<TopicHandler>>();

  constructor(seed?: Record<string, unknown>) {
    this.data = { ...(seed ?? {}) };
  }

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async fetch(query: any): Promise<any> {
    if (typeof query === 'string') {
      return this.data[query];
    }
    if (query && typeof query === 'object') {
      if (typeof query.key === 'string') {
        return this.data[query.key];
      }
      if (query.patch && typeof query.patch === 'object') {
        Object.assign(this.data, query.patch as Record<string, unknown>);
      }
      return this.data;
    }
    return this.data;
  }

  subscribe(topic: string, handler: Function): void {
    const listeners = this.listeners.get(topic) ?? new Set<TopicHandler>();
    listeners.add(handler as TopicHandler);
    this.listeners.set(topic, listeners);
  }

  publish(topic: string, payload: unknown): void {
    const listeners = this.listeners.get(topic);
    if (!listeners) return;
    listeners.forEach((handler) => handler(payload));
  }
}
