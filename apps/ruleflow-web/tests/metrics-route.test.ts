import { describe, expect, it } from 'vitest';

describe('metrics route exposition', () => {
  it('includes Prometheus HELP/TYPE metadata lines', async () => {
    const metrics = await import('../src/server/metrics');
    metrics.resetMetricsForTests();

    const route = await import('../src/app/api/metrics/route');
    const response = await route.GET();
    const body = await response.text();
    const metadataLines = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('# HELP') || line.startsWith('# TYPE'));

    expect(metadataLines).toMatchInlineSnapshot(`
      [
        "# HELP rule_eval_count Total rule clauses evaluated",
        "# TYPE rule_eval_count counter",
        "# HELP rule_match_count Total matched rules",
        "# TYPE rule_match_count counter",
        "# HELP flow_transitions_count Total flow transitions observed",
        "# TYPE flow_transitions_count counter",
        "# HELP api_call_count Total API calls",
        "# TYPE api_call_count counter",
        "# HELP bundle_load_count Total bundle load operations",
        "# TYPE bundle_load_count counter",
        "# HELP error_count Total errors",
        "# TYPE error_count counter",
        "# HELP rule_eval_latency_ms Histogram of rule evaluation latency in milliseconds",
        "# TYPE rule_eval_latency_ms histogram",
        "# HELP api_latency_ms Histogram of API latency in milliseconds",
        "# TYPE api_latency_ms histogram",
        "# HELP bundle_load_latency_ms Histogram of bundle load latency in milliseconds",
        "# TYPE bundle_load_latency_ms histogram",
        "# HELP bundle_chunk_load_latency_ms Histogram of bundle chunk load latency in milliseconds",
        "# TYPE bundle_chunk_load_latency_ms histogram",
        "# HELP ui_render_latency_ms Histogram of UI render latency in milliseconds",
        "# TYPE ui_render_latency_ms histogram",
      ]
    `);
  });
});
