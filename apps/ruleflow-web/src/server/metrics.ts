type Histogram = {
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
};

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500];

function createHistogram(buckets = DEFAULT_BUCKETS): Histogram {
  return {
    buckets,
    counts: buckets.map(() => 0),
    sum: 0,
    count: 0,
  };
}

function observe(histogram: Histogram, valueMs: number): void {
  histogram.sum += valueMs;
  histogram.count += 1;
  for (let index = 0; index < histogram.buckets.length; index += 1) {
    const bucket = histogram.buckets[index];
    if (bucket === undefined) continue;
    if (valueMs <= bucket) {
      const next = (histogram.counts[index] ?? 0) + 1;
      histogram.counts[index] = next;
    }
  }
}

const state = {
  ruleEvalCount: 0,
  ruleMatchCount: 0,
  flowTransitionCount: 0,
  errorCount: 0,
  apiCalls: 0,
  ruleLatency: createHistogram(),
  apiLatency: createHistogram(),
};

export function recordApiCall(durationMs: number, statusCode: number): void {
  state.apiCalls += 1;
  observe(state.apiLatency, durationMs);
  if (statusCode >= 500) {
    state.errorCount += 1;
  }
}

export function recordRuntimeTrace(trace: Record<string, unknown>): void {
  const rules = asRecord(trace.rules);
  const flow = asRecord(trace.flow);
  if (flow) {
    state.flowTransitionCount += 1;
  }
  if (rules) {
    state.ruleEvalCount += Number(rules.rulesConsidered && Array.isArray(rules.rulesConsidered) ? rules.rulesConsidered.length : 0);
    state.ruleMatchCount += Number(rules.rulesMatched && Array.isArray(rules.rulesMatched) ? rules.rulesMatched.length : 0);
    const latency = toNumber(rules.durationMs);
    if (latency !== null) {
      observe(state.ruleLatency, latency);
    }
    const errors = rules.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      state.errorCount += errors.length;
    }
  }
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [];
  lines.push('# HELP rule_eval_count Total rule clauses evaluated');
  lines.push('# TYPE rule_eval_count counter');
  lines.push(`rule_eval_count ${state.ruleEvalCount}`);
  lines.push('# HELP rule_match_count Total matched rules');
  lines.push('# TYPE rule_match_count counter');
  lines.push(`rule_match_count ${state.ruleMatchCount}`);
  lines.push('# HELP flow_transitions_count Total flow transitions observed');
  lines.push('# TYPE flow_transitions_count counter');
  lines.push(`flow_transitions_count ${state.flowTransitionCount}`);
  lines.push('# HELP api_call_count Total API calls');
  lines.push('# TYPE api_call_count counter');
  lines.push(`api_call_count ${state.apiCalls}`);
  lines.push('# HELP error_count Total errors');
  lines.push('# TYPE error_count counter');
  lines.push(`error_count ${state.errorCount}`);
  lines.push(...histogramLines('rule_eval_latency_ms', state.ruleLatency));
  lines.push(...histogramLines('api_latency_ms', state.apiLatency));
  return `${lines.join('\n')}\n`;
}

function histogramLines(name: string, histogram: Histogram): string[] {
  const lines = [
    `# HELP ${name} Histogram of ${name}`,
    `# TYPE ${name} histogram`,
  ];
  let cumulative = 0;
  for (let index = 0; index < histogram.buckets.length; index += 1) {
    const bucket = histogram.buckets[index];
    if (bucket === undefined) continue;
    cumulative += histogram.counts[index] ?? 0;
    lines.push(`${name}_bucket{le="${bucket}"} ${cumulative}`);
  }
  lines.push(`${name}_bucket{le="+Inf"} ${histogram.count}`);
  lines.push(`${name}_sum ${histogram.sum}`);
  lines.push(`${name}_count ${histogram.count}`);
  return lines;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}
