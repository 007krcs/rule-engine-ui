export interface EventPayload {
  type: string;
  data?: any;
}

type EventHandler = (data: any) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  subscribe(type: string, handler: EventHandler): void {
    const handlers = this.listeners.get(type) ?? new Set<EventHandler>();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }

  unsubscribe(type: string, handler: Function): void {
    const handlers = this.listeners.get(type);
    if (!handlers) return;
    handlers.delete(handler as EventHandler);
    if (handlers.size === 0) {
      this.listeners.delete(type);
    }
  }

  publish(type: string, data?: any): void {
    const payload: EventPayload = { type, data };
    const handlers = this.listeners.get(payload.type);
    if (!handlers) return;
    handlers.forEach((handler) => {
      handler(payload.data);
    });
  }
}

export const eventBus = new EventBus();
