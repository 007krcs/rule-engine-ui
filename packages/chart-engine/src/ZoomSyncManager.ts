import { eventBus } from '@platform/runtime';

export type ZoomRange = { min: number; max: number };

export class ZoomSyncManager {
  private readonly listeners = new Map<string, (range: ZoomRange) => void>();

  sync(chartId: string, range: ZoomRange): void {
    eventBus.publish('chart.zoom.sync', { chartId, range });
  }

  subscribe(chartId: string, handler: (range: ZoomRange) => void): () => void {
    const listener = (payload: unknown) => {
      const record = payload as { chartId?: string; range?: ZoomRange };
      if (!record || record.chartId === chartId) return;
      if (!record.range) return;
      handler(record.range);
    };
    this.listeners.set(chartId, listener);
    eventBus.subscribe('chart.zoom.sync', listener);
    return () => {
      const current = this.listeners.get(chartId);
      if (current) {
        eventBus.unsubscribe('chart.zoom.sync', current);
        this.listeners.delete(chartId);
      }
    };
  }
}
