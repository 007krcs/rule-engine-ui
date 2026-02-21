import type { DataSourceAdapter, DispatchRequest } from './DataSourceAdapter';
import { applySafeTransform } from './safe-transform';

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

  async dispatch(request: DispatchRequest): Promise<unknown> {
    const topic = request.topic;
    if (topic && request.payload !== undefined) {
      this.publish(topic, request.payload);
      return request.payload;
    }
    const value = await this.fetch(request);
    return applySafeTransform(value, {
      template: request.transformTemplate,
      selector: request.selector,
    });
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
