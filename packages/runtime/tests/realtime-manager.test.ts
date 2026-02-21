import { describe, expect, it, vi } from 'vitest';
import type { DataSourceAdapter } from '../src/data-source/DataSourceAdapter';
import { RealtimeManager } from '../src/realtime/RealtimeManager';

class FakeStreamingAdapter implements DataSourceAdapter {
  private readonly handlers = new Map<string, Set<Function>>();
  connect = vi.fn(async () => undefined);
  fetch = vi.fn(async () => undefined);

  subscribe(topic: string, handler: Function): void {
    const set = this.handlers.get(topic) ?? new Set<Function>();
    set.add(handler);
    this.handlers.set(topic, set);
  }

  emit(topic: string, payload: unknown): void {
    const set = this.handlers.get(topic);
    if (!set) return;
    set.forEach((handler) => handler(payload));
  }
}

describe('realtime manager', () => {
  it('pools adapter connections across subscriptions', async () => {
    const adapter = new FakeStreamingAdapter();
    const manager = new RealtimeManager();

    const unsubscribeA = await manager.subscribe(adapter, { topic: 'orders' }, () => undefined);
    const unsubscribeB = await manager.subscribe(adapter, { topic: 'orders' }, () => undefined);

    expect(adapter.connect).toHaveBeenCalledTimes(1);

    unsubscribeA();
    unsubscribeB();
    manager.destroy();
  });

  it('reconciles delta patches', async () => {
    vi.useFakeTimers();
    const adapter = new FakeStreamingAdapter();
    const manager = new RealtimeManager();
    let latest: unknown;

    const unsubscribe = await manager.subscribe(
      adapter,
      { topic: 'positions', deltaPatch: true },
      (state) => {
        latest = state;
      },
    );

    adapter.emit('positions', { book: { bids: 2 }, status: 'warm' });
    adapter.emit('positions', { book: { asks: 5 } });
    vi.advanceTimersByTime(20);

    expect(latest).toEqual({ book: { bids: 2, asks: 5 }, status: 'warm' });

    unsubscribe();
    manager.destroy();
    vi.useRealTimers();
  });

  it('throttles and batches high-frequency streams (500 updates/sec)', async () => {
    vi.useFakeTimers();
    const adapter = new FakeStreamingAdapter();
    const manager = new RealtimeManager();
    const received: Array<{ seq: number }> = [];

    const unsubscribe = await manager.subscribe(
      adapter,
      { topic: 'ticks', throttleMs: 50 },
      (state) => {
        received.push(state as { seq: number });
      },
    );

    for (let i = 0; i < 500; i += 1) {
      setTimeout(() => adapter.emit('ticks', { seq: i }), i * 2);
    }

    vi.advanceTimersByTime(1200);

    expect(received.length).toBeLessThanOrEqual(25);
    expect(received[received.length - 1]?.seq).toBe(499);

    unsubscribe();
    manager.destroy();
    vi.useRealTimers();
  });
});
