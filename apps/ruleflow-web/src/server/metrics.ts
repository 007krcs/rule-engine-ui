type Histogram = {
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
};

type Labels = Record<string, string>;

type CounterMetric = Map<string, { labels: Labels; value: number }>;
type HistogramMetric = Map<string, { labels: Labels; histogram: Histogram }>;

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500];
const MAX_TENANT_LABEL_CARDINALITY = 25;
const ENV_LABEL_ALLOWLIST = new Set(['prod', 'staging', 'dev', 'test', 'local']);

const knownTenantLabels = new Set<string>(['unknown', 'other']);

function createHistogram(buckets = DEFAULT_BUCKETS): Histogram {
  return {
    buckets,
    counts: buckets.map(() => 0),
    sum: 0,
    count: 0,
  };
}

function createCounterMetric(): CounterMetric {
  return new Map<string, { labels: Labels; value: number }>();
}

function createHistogramMetric(): HistogramMetric {
  return new Map<string, { labels: Labels; histogram: Histogram }>();
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
  ruleEvalCount: createCounterMetric(),
  ruleMatchCount: createCounterMetric(),
  flowTransitionCount: createCounterMetric(),
  errorCount: createCounterMetric(),
  apiCalls: createCounterMetric(),
  ruleLatency: createHistogramMetric(),
  apiLatency: createHistogramMetric(),
};

export function recordApiCall(
  durationMs: number,
  statusCode: number,
  input?: {
    tenantId?: string;
    env?: string;
  },
): void {
  const commonLabels = normalizeCommonLabels(input);
  const statusClass = classifyStatusCode(statusCode);
  const apiLabels = {
    ...commonLabels,
    status_class: statusClass,
  };

  incrementCounter(state.apiCalls, apiLabels, 1);
  observeHistogram(state.apiLatency, apiLabels, durationMs);

  if (statusCode >= 500) {
    incrementCounter(
      state.errorCount,
      {
        ...commonLabels,
        source: 'api',
        status_class: statusClass,
      },
      1,
    );
  }
}

export function recordRuntimeTrace(
  trace: Record<string, unknown>,
  input?: {
    tenantId?: string;
    env?: string;
  },
): void {
  const traceContext = asRecord(trace.context);
  const labels = normalizeCommonLabels({
    tenantId: input?.tenantId ?? readString(traceContext?.tenantId) ?? readString(trace.tenantId) ?? undefined,
    env: input?.env ?? readString(traceContext?.env) ?? undefined,
  });

  const rules = asRecord(trace.rules);
  const flow = asRecord(trace.flow);

  if (flow) {
    incrementCounter(state.flowTransitionCount, labels, 1);
  }

  if (rules) {
    const considered = Array.isArray(rules.rulesConsidered) ? rules.rulesConsidered.length : 0;
    const matched = Array.isArray(rules.rulesMatched) ? rules.rulesMatched.length : 0;
    incrementCounter(state.ruleEvalCount, labels, considered);
    incrementCounter(state.ruleMatchCount, labels, matched);

    const latency = toNumber(rules.durationMs);
    if (latency !== null) {
      observeHistogram(state.ruleLatency, labels, latency);
    }

    const errors = Array.isArray(rules.errors) ? rules.errors.length : 0;
    if (errors > 0) {
      incrementCounter(
        state.errorCount,
        {
          ...labels,
          source: 'runtime',
          status_class: 'runtime',
        },
        errors,
      );
    }
  }
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [];
  lines.push(...counterLines('rule_eval_count', 'Total rule clauses evaluated', state.ruleEvalCount));
  lines.push(...counterLines('rule_match_count', 'Total matched rules', state.ruleMatchCount));
  lines.push(...counterLines('flow_transitions_count', 'Total flow transitions observed', state.flowTransitionCount));
  lines.push(...counterLines('api_call_count', 'Total API calls', state.apiCalls));
  lines.push(...counterLines('error_count', 'Total errors', state.errorCount));
  lines.push(...histogramLines('rule_eval_latency_ms', 'Histogram of rule evaluation latency in milliseconds', state.ruleLatency));
  lines.push(...histogramLines('api_latency_ms', 'Histogram of API latency in milliseconds', state.apiLatency));
  return `${lines.join('\n')}\n`;
}

export function resetMetricsForTests(): void {
  state.ruleEvalCount.clear();
  state.ruleMatchCount.clear();
  state.flowTransitionCount.clear();
  state.errorCount.clear();
  state.apiCalls.clear();
  state.ruleLatency.clear();
  state.apiLatency.clear();
  knownTenantLabels.clear();
  knownTenantLabels.add('unknown');
  knownTenantLabels.add('other');
}

function counterLines(name: string, help: string, metric: CounterMetric): string[] {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`];
  const entries = [...metric.values()].sort((left, right) => labelKey(left.labels).localeCompare(labelKey(right.labels)));
  for (const entry of entries) {
    lines.push(`${name}${formatLabelSet(entry.labels)} ${entry.value}`);
  }
  return lines;
}

function histogramLines(name: string, help: string, metric: HistogramMetric): string[] {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} histogram`];
  const entries = [...metric.values()].sort((left, right) => labelKey(left.labels).localeCompare(labelKey(right.labels)));
  for (const entry of entries) {
    let cumulative = 0;
    for (let index = 0; index < entry.histogram.buckets.length; index += 1) {
      const bucket = entry.histogram.buckets[index];
      if (bucket === undefined) continue;
      cumulative += entry.histogram.counts[index] ?? 0;
      lines.push(`${name}_bucket${formatLabelSet({ ...entry.labels, le: String(bucket) })} ${cumulative}`);
    }
    lines.push(`${name}_bucket${formatLabelSet({ ...entry.labels, le: '+Inf' })} ${entry.histogram.count}`);
    lines.push(`${name}_sum${formatLabelSet(entry.labels)} ${entry.histogram.sum}`);
    lines.push(`${name}_count${formatLabelSet(entry.labels)} ${entry.histogram.count}`);
  }
  return lines;
}

function incrementCounter(metric: CounterMetric, labels: Labels, by: number): void {
  const key = labelKey(labels);
  const existing = metric.get(key);
  if (existing) {
    existing.value += by;
    return;
  }
  metric.set(key, {
    labels: { ...labels },
    value: by,
  });
}

function observeHistogram(metric: HistogramMetric, labels: Labels, valueMs: number): void {
  const key = labelKey(labels);
  const existing = metric.get(key);
  if (existing) {
    observe(existing.histogram, valueMs);
    return;
  }
  const histogram = createHistogram();
  observe(histogram, valueMs);
  metric.set(key, {
    labels: { ...labels },
    histogram,
  });
}

function normalizeCommonLabels(input?: { tenantId?: string; env?: string }): Labels {
  return {
    env: normalizeEnvLabel(input?.env),
    tenant_id: normalizeTenantLabel(input?.tenantId),
  };
}

function classifyStatusCode(statusCode: number): string {
  if (statusCode >= 500) return '5xx';
  if (statusCode >= 400) return '4xx';
  if (statusCode >= 300) return '3xx';
  if (statusCode >= 200) return '2xx';
  return 'other';
}

function normalizeEnvLabel(rawEnv?: string): string {
  const fallback = process.env.RULEFLOW_ENV ?? process.env.NODE_ENV ?? 'dev';
  const candidate = sanitizeLabelValue(rawEnv ?? fallback) || 'dev';
  return ENV_LABEL_ALLOWLIST.has(candidate) ? candidate : 'other';
}

function normalizeTenantLabel(rawTenantId?: string): string {
  const candidate = sanitizeLabelValue(rawTenantId) || 'unknown';
  if (knownTenantLabels.has(candidate)) {
    return candidate;
  }
  if (knownTenantLabels.size >= MAX_TENANT_LABEL_CARDINALITY) {
    return 'other';
  }
  knownTenantLabels.add(candidate);
  return candidate;
}

function formatLabelSet(labels: Labels): string {
  const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return '';
  const content = entries.map(([key, value]) => `${key}="${escapeLabelValue(value)}"`).join(',');
  return `{${content}}`;
}

function labelKey(labels: Labels): string {
  return Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
}

function sanitizeLabelValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40);
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}
