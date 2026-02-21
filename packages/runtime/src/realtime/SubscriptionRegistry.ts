import type { RealtimeConfig } from './RealtimeManager';

export type RealtimeUpdateHandler<TState = unknown> = (state: TState) => void;

export interface SubscriptionRecord<TState = unknown> {
  id: string;
  config: RealtimeConfig;
  handler: RealtimeUpdateHandler<TState>;
  active: boolean;
  state?: TState;
}

export class SubscriptionRegistry {
  private readonly subscriptions = new Map<string, SubscriptionRecord>();
  private readonly byTopic = new Map<string, Set<string>>();

  register(record: SubscriptionRecord): void {
    this.subscriptions.set(record.id, record);
    const set = this.byTopic.get(record.config.topic) ?? new Set<string>();
    set.add(record.id);
    this.byTopic.set(record.config.topic, set);
  }

  get(id: string): SubscriptionRecord | undefined {
    return this.subscriptions.get(id);
  }

  listByTopic(topic: string): SubscriptionRecord[] {
    const ids = this.byTopic.get(topic);
    if (!ids) return [];
    const records: SubscriptionRecord[] = [];
    for (const id of ids) {
      const record = this.subscriptions.get(id);
      if (record) records.push(record);
    }
    return records;
  }

  remove(id: string): void {
    const record = this.subscriptions.get(id);
    if (!record) return;
    this.subscriptions.delete(id);
    const ids = this.byTopic.get(record.config.topic);
    if (!ids) return;
    ids.delete(id);
    if (ids.size === 0) {
      this.byTopic.delete(record.config.topic);
    }
  }

  clear(): void {
    this.subscriptions.clear();
    this.byTopic.clear();
  }
}
