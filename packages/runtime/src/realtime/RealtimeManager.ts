import type { DataSourceAdapter } from '../data-source/DataSourceAdapter';
import {
  SubscriptionRegistry,
  type RealtimeUpdateHandler,
  type SubscriptionRecord,
} from './SubscriptionRegistry';

export interface RealtimeConfig {
  topic: string;
  throttleMs?: number;
  deltaPatch?: boolean;
}

type Clock = () => number;

type RealtimeManagerOptions = {
  now?: Clock;
  scheduleFrame?: (run: () => void) => () => void;
};

type PooledConnection = {
  refs: number;
  connecting: Promise<void> | null;
};

type RuntimeSubscriptionState = {
  pending?: unknown;
  lastEmittedAt: number;
  frameCancel?: () => void;
  throttleTimer?: ReturnType<typeof setTimeout>;
};

export class RealtimeManager {
  private readonly registry = new SubscriptionRegistry();
  private readonly runtimeState = new Map<string, RuntimeSubscriptionState>();
  private readonly adapterPools = new WeakMap<DataSourceAdapter, PooledConnection>();
  private readonly adapterTopicBindings = new Map<DataSourceAdapter, Set<string>>();
  private sequence = 0;
  private readonly now: Clock;
  private readonly scheduleFrame: (run: () => void) => () => void;

  constructor(options?: RealtimeManagerOptions) {
    this.now = options?.now ?? (() => Date.now());
    this.scheduleFrame = options?.scheduleFrame ?? defaultScheduleFrame;
  }

  async subscribe(
    adapter: DataSourceAdapter,
    config: RealtimeConfig,
    handler: RealtimeUpdateHandler,
  ): Promise<() => void> {
    await this.ensureConnected(adapter);
    this.ensureAdapterTopicBinding(adapter, config.topic);

    const id = `sub:${++this.sequence}`;
    this.registry.register({
      id,
      config,
      handler,
      active: true,
    });
    this.runtimeState.set(id, {
      lastEmittedAt: 0,
    });

    return () => this.unsubscribe(adapter, id);
  }

  destroy(): void {
    this.registry.clear();
    for (const state of this.runtimeState.values()) {
      if (state.frameCancel) state.frameCancel();
      if (state.throttleTimer) clearTimeout(state.throttleTimer);
    }
    this.runtimeState.clear();
    this.adapterTopicBindings.clear();
  }

  private async ensureConnected(adapter: DataSourceAdapter): Promise<void> {
    const pooled = this.adapterPools.get(adapter);
    if (pooled) {
      pooled.refs += 1;
      if (pooled.connecting) {
        await pooled.connecting;
      }
      return;
    }

    const connecting = adapter.connect();
    this.adapterPools.set(adapter, { refs: 1, connecting });
    try {
      await connecting;
    } finally {
      const current = this.adapterPools.get(adapter);
      if (current) {
        current.connecting = null;
      }
    }
  }

  private ensureAdapterTopicBinding(adapter: DataSourceAdapter, topic: string): void {
    const topics = this.adapterTopicBindings.get(adapter) ?? new Set<string>();
    if (topics.has(topic)) return;
    topics.add(topic);
    this.adapterTopicBindings.set(adapter, topics);

    adapter.subscribe?.(topic, (payload: unknown) => {
      const subscriptions = this.registry.listByTopic(topic);
      subscriptions.forEach((record) => this.enqueueUpdate(record, payload));
    });
  }

  private enqueueUpdate(record: SubscriptionRecord, payload: unknown): void {
    if (!record.active) return;
    const state = this.runtimeState.get(record.id);
    if (!state) return;

    state.pending = record.config.deltaPatch
      ? reconcileDeltaPatch(state.pending, payload)
      : payload;

    if (state.frameCancel) return;
    state.frameCancel = this.scheduleFrame(() => {
      state.frameCancel = undefined;
      this.flush(record);
    });
  }

  private flush(record: SubscriptionRecord): void {
    const state = this.runtimeState.get(record.id);
    if (!state || !record.active) return;
    if (state.pending === undefined) return;

    const throttleMs = Math.max(0, Math.trunc(record.config.throttleMs ?? 0));
    const now = this.now();
    const elapsed = now - state.lastEmittedAt;
    if (throttleMs > 0 && elapsed < throttleMs) {
      if (state.throttleTimer) return;
      state.throttleTimer = setTimeout(() => {
        state.throttleTimer = undefined;
        this.flush(record);
      }, throttleMs - elapsed);
      return;
    }

    const next = state.pending;
    state.pending = undefined;
    state.lastEmittedAt = now;
    record.state = next;
    record.handler(next);
  }

  private unsubscribe(adapter: DataSourceAdapter, id: string): void {
    const record = this.registry.get(id);
    if (!record) return;
    record.active = false;
    this.registry.remove(id);

    const runtime = this.runtimeState.get(id);
    if (runtime?.frameCancel) runtime.frameCancel();
    if (runtime?.throttleTimer) clearTimeout(runtime.throttleTimer);
    this.runtimeState.delete(id);

    const pool = this.adapterPools.get(adapter);
    if (!pool) return;
    pool.refs = Math.max(0, pool.refs - 1);
    if (pool.refs === 0) {
      this.adapterPools.delete(adapter);
      this.adapterTopicBindings.delete(adapter);
    }
  }
}

function defaultScheduleFrame(run: () => void): () => void {
  if (typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function') {
    const id = requestAnimationFrame(() => run());
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(run, 16);
  return () => clearTimeout(id);
}

function reconcileDeltaPatch(previous: unknown, patch: unknown): unknown {
  if (previous === undefined) return toPatchValue(patch);
  if (!isRecord(previous) || !isRecord(patch)) return toPatchValue(patch);

  const next: Record<string, unknown> = { ...previous };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) {
      next[key] = value;
      continue;
    }
    const prevValue = next[key];
    if (isRecord(prevValue) && isRecord(value)) {
      next[key] = reconcileDeltaPatch(prevValue, value);
      continue;
    }
    next[key] = toPatchValue(value);
  }
  return next;
}

function toPatchValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => toPatchValue(entry));
  if (!isRecord(value)) return value;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    next[key] = toPatchValue(entry);
  }
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
