import { describe, expect, it } from 'vitest';
import {
  recordBundleLoad,
  recordUiRender,
  registerMetricSink,
  resetMetricsForTests,
} from '../src/server/metrics';

describe('metrics sinks', () => {
  it('emits metric events for APM sinks', () => {
    resetMetricsForTests();
    const events: Array<{ metric: string; value: number }> = [];
    const dispose = registerMetricSink((event) => {
      events.push({ metric: event.metric, value: event.value });
    });

    recordBundleLoad(12, { tenantId: 'tenant-1', env: 'test', source: 'api', chunked: false });
    recordUiRender(8, { tenantId: 'tenant-1', env: 'test', surface: 'builder' });
    dispose();

    expect(events.some((event) => event.metric === 'bundle_load_count')).toBe(true);
    expect(events.some((event) => event.metric === 'bundle_load_latency_ms')).toBe(true);
    expect(events.some((event) => event.metric === 'ui_render_latency_ms')).toBe(true);
  });
});
