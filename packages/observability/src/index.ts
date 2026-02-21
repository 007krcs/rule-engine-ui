import type { RuleAction, JSONValue } from '@platform/schema';

export type ExplainOperand =
  | { kind: 'path'; path: string; value: JSONValue | undefined }
  | { kind: 'value'; value: JSONValue };

export type ConditionExplain =
  | { kind: 'all'; result: boolean; children: ConditionExplain[] }
  | { kind: 'any'; result: boolean; children: ConditionExplain[] }
  | { kind: 'not'; result: boolean; child: ConditionExplain }
  | { kind: 'compare'; result: boolean; op: string; left: ExplainOperand; right?: ExplainOperand };

export interface RuleRead {
  path: string;
  value: JSONValue | undefined;
}

export interface RuleActionDiff {
  ruleId: string;
  action: RuleAction;
  target: 'data' | 'context';
  path: string;
  before: JSONValue | undefined;
  after: JSONValue | undefined;
}

export interface RulesTrace {
  startedAt: string;
  durationMs: number;
  rulesConsidered: string[];
  rulesMatched: string[];
  conditionResults: Record<string, boolean>;
  conditionExplains?: Record<string, ConditionExplain>;
  readsByRuleId?: Record<string, RuleRead[]>;
  actionDiffs?: RuleActionDiff[];
  actionsApplied: Array<{ ruleId: string; action: RuleAction }>;
  events: Array<{ ruleId: string; event: string; payload?: JSONValue }>;
  errors: Array<{ ruleId?: string; message: string }>;
  context?: {
    correlationId?: string;
    tenantId?: string;
    userId?: string;
    versionId?: string;
  };
}

export interface FlowTrace {
  startedAt: string;
  durationMs: number;
  event: string;
  fromStateId: string;
  toStateId: string;
  uiPageId: string;
  guardResult?: boolean;
  reason: 'ok' | 'no_transition' | 'guard_failed' | 'error';
  actionsToRun: string[];
  errorMessage?: string;
}

export interface ApiTrace {
  startedAt: string;
  durationMs: number;
  apiId: string;
  method: string;
  endpoint: string;
  request: {
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    body?: unknown;
  };
  response?: {
    status: number;
    body?: unknown;
  };
  error?: string;
}

export interface RuntimeTrace {
  startedAt: string;
  durationMs: number;
  flow: FlowTrace;
  rules?: RulesTrace;
  api?: ApiTrace;
  context?: {
    correlationId?: string;
    tenantId?: string;
    userId?: string;
    versionId?: string;
  };
}

export type TraceLogger<T> = (message: string, trace: T) => void;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogContext {
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  versionId?: string;
  module?: string;
}

export interface LogLevelInput {
  module: string;
  tenantId?: string;
}

export interface OTelSpanEvent {
  name: string;
  timeUnixNano: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface OTelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: Record<string, string | number | boolean>;
  status?: { code: 'OK' | 'ERROR'; message?: string };
  events?: OTelSpanEvent[];
}

export interface OTelMetricPoint {
  name: string;
  description?: string;
  unit?: string;
  value: number;
  timeUnixNano: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface OTelExporter {
  exportSpans?: (spans: OTelSpan[]) => void | Promise<void>;
  exportMetrics?: (metrics: OTelMetricPoint[]) => void | Promise<void>;
}

export interface BusinessMetric {
  name: string;
  value: number;
  unit?: string;
  attributes?: Record<string, string | number | boolean>;
}

const otelExporters = new Set<OTelExporter>();
const businessMetricHooks = new Set<(metric: BusinessMetric) => void>();
let logLevelResolver: (input: LogLevelInput) => LogLevel = defaultLogLevelResolver;

export function setLogLevelResolver(
  resolver: (input: LogLevelInput) => LogLevel,
): void {
  logLevelResolver = resolver;
}

export function resetLogLevelResolver(): void {
  logLevelResolver = defaultLogLevelResolver;
}

export function shouldLog(level: LogLevel, input: LogLevelInput): boolean {
  const resolved = logLevelResolver(input);
  return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[resolved];
}

export function registerOpenTelemetryExporter(exporter: OTelExporter): () => void {
  otelExporters.add(exporter);
  return () => {
    otelExporters.delete(exporter);
  };
}

export function registerBusinessMetricHook(hook: (metric: BusinessMetric) => void): () => void {
  businessMetricHooks.add(hook);
  return () => {
    businessMetricHooks.delete(hook);
  };
}

export function emitBusinessMetric(metric: BusinessMetric): void {
  for (const hook of businessMetricHooks) {
    hook(metric);
  }
  const point: OTelMetricPoint = {
    name: metric.name,
    unit: metric.unit,
    value: metric.value,
    timeUnixNano: toUnixNano(Date.now()),
    attributes: metric.attributes,
  };
  for (const exporter of otelExporters) {
    if (exporter.exportMetrics) {
      void exporter.exportMetrics([point]);
    }
  }
}

export function exportOpenTelemetrySpans(spans: OTelSpan[]): void {
  for (const exporter of otelExporters) {
    if (exporter.exportSpans) {
      void exporter.exportSpans(spans);
    }
  }
}

export function exportOpenTelemetryMetrics(metrics: OTelMetricPoint[]): void {
  for (const exporter of otelExporters) {
    if (exporter.exportMetrics) {
      void exporter.exportMetrics(metrics);
    }
  }
}

export function toOpenTelemetryTraceExportPayload(spans: OTelSpan[]): {
  resourceSpans: Array<{
    resource: { attributes: Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } }> };
    scopeSpans: Array<{
      scope: { name: string; version: string };
      spans: Array<{
        traceId: string;
        spanId: string;
        parentSpanId?: string;
        name: string;
        kind?: string;
        startTimeUnixNano: string;
        endTimeUnixNano: string;
        attributes?: Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } }>;
        status?: { code: string; message?: string };
      }>;
    }>;
  }>;
} {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: 'ruleflow' } }],
        },
        scopeSpans: [
          {
            scope: { name: '@platform/observability', version: '0.1.0' },
            spans: spans.map((span) => ({
              traceId: span.traceId,
              spanId: span.spanId,
              parentSpanId: span.parentSpanId,
              name: span.name,
              kind: span.kind,
              startTimeUnixNano: span.startTimeUnixNano,
              endTimeUnixNano: span.endTimeUnixNano,
              attributes: attrsToOtel(span.attributes),
              status: span.status ? { code: span.status.code, message: span.status.message } : undefined,
            })),
          },
        ],
      },
    ],
  };
}

export function toOpenTelemetryMetricExportPayload(metrics: OTelMetricPoint[]): {
  resourceMetrics: Array<{
    resource: { attributes: Array<{ key: string; value: { stringValue?: string } }> };
    scopeMetrics: Array<{
      scope: { name: string; version: string };
      metrics: Array<{
        name: string;
        description?: string;
        unit?: string;
        sum: {
          dataPoints: Array<{
            asDouble: number;
            timeUnixNano: string;
            attributes?: Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } }>;
          }>;
          aggregationTemporality: string;
          isMonotonic: boolean;
        };
      }>;
    }>;
  }>;
} {
  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: 'ruleflow' } }],
        },
        scopeMetrics: [
          {
            scope: { name: '@platform/observability', version: '0.1.0' },
            metrics: metrics.map((metric) => ({
              name: metric.name,
              description: metric.description,
              unit: metric.unit,
              sum: {
                dataPoints: [
                  {
                    asDouble: metric.value,
                    timeUnixNano: metric.timeUnixNano,
                    attributes: attrsToOtel(metric.attributes),
                  },
                ],
                aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
                isMonotonic: false,
              },
            })),
          },
        ],
      },
    ],
  };
}

export function createExternalCallSpan(input: {
  name: string;
  module: string;
  startedAtMs: number;
  endedAtMs: number;
  tenantId?: string;
  correlationId?: string;
  attributes?: Record<string, string | number | boolean>;
  errorMessage?: string;
}): OTelSpan {
  return {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    name: input.name,
    kind: 'CLIENT',
    startTimeUnixNano: toUnixNano(input.startedAtMs),
    endTimeUnixNano: toUnixNano(input.endedAtMs),
    attributes: {
      'ruleflow.module': input.module,
      'ruleflow.tenant_id': input.tenantId ?? 'unknown',
      'ruleflow.correlation_id': input.correlationId ?? 'none',
      ...(input.attributes ?? {}),
    },
    status: input.errorMessage ? { code: 'ERROR', message: input.errorMessage } : { code: 'OK' },
  };
}

export async function withExternalCallInstrumentation<T>(input: {
  name: string;
  module: string;
  tenantId?: string;
  correlationId?: string;
  attributes?: Record<string, string | number | boolean>;
  fn: () => Promise<T>;
}): Promise<T> {
  const started = Date.now();
  try {
    const value = await input.fn();
    const ended = Date.now();
    const span = createExternalCallSpan({
      name: input.name,
      module: input.module,
      startedAtMs: started,
      endedAtMs: ended,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      attributes: input.attributes,
    });
    exportOpenTelemetrySpans([span]);
    emitBusinessMetric({
      name: 'external_call_duration_ms',
      value: ended - started,
      unit: 'ms',
      attributes: {
        module: input.module,
        call: input.name,
        tenant_id: input.tenantId ?? 'unknown',
        ok: true,
      },
    });
    return value;
  } catch (error) {
    const ended = Date.now();
    const message = error instanceof Error ? error.message : String(error);
    const span = createExternalCallSpan({
      name: input.name,
      module: input.module,
      startedAtMs: started,
      endedAtMs: ended,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      attributes: input.attributes,
      errorMessage: message,
    });
    exportOpenTelemetrySpans([span]);
    emitBusinessMetric({
      name: 'external_call_duration_ms',
      value: ended - started,
      unit: 'ms',
      attributes: {
        module: input.module,
        call: input.name,
        tenant_id: input.tenantId ?? 'unknown',
        ok: false,
      },
    });
    throw error;
  }
}

export function formatRulesTrace(trace: RulesTrace): string {
  return `RulesTrace: ${trace.rulesMatched.length}/${trace.rulesConsidered.length} matched in ${trace.durationMs}ms`;
}

export function logRulesTrace(trace: RulesTrace, logger: TraceLogger<RulesTrace> = defaultTraceLogger): void {
  const context = inferLogContext(trace, 'rules-engine');
  if (!shouldLog('info', { module: context.module ?? 'rules-engine', tenantId: context.tenantId })) {
    return;
  }
  emitBusinessMetric({
    name: 'rules.duration_ms',
    value: trace.durationMs,
    unit: 'ms',
    attributes: {
      module: 'rules-engine',
      tenant_id: context.tenantId ?? 'unknown',
      matched: trace.rulesMatched.length,
      considered: trace.rulesConsidered.length,
      errors: trace.errors.length,
    },
  });
  exportOpenTelemetrySpans([spanFromRulesTrace(trace, context)]);
  logger(withLogContext(formatRulesTrace(trace), context), trace);
}

export function formatRuntimeTrace(trace: RuntimeTrace): string {
  const rules = trace.rules ? `${trace.rules.rulesMatched.length} rules matched` : 'rules skipped';
  const api = trace.api ? `api ${trace.api.apiId}` : 'api skipped';
  return `RuntimeTrace: ${trace.flow.reason} in ${trace.durationMs}ms (${rules}, ${api})`;
}

export function logRuntimeTrace(trace: RuntimeTrace, logger: TraceLogger<RuntimeTrace> = defaultTraceLogger): void {
  const context = inferLogContext(trace, 'core-runtime');
  if (!shouldLog('info', { module: context.module ?? 'core-runtime', tenantId: context.tenantId })) {
    return;
  }
  emitBusinessMetric({
    name: 'runtime.duration_ms',
    value: trace.durationMs,
    unit: 'ms',
    attributes: {
      module: 'core-runtime',
      tenant_id: context.tenantId ?? 'unknown',
      flow_reason: trace.flow.reason,
      has_rules: Boolean(trace.rules),
      has_api: Boolean(trace.api),
    },
  });
  exportOpenTelemetrySpans([spanFromRuntimeTrace(trace, context)]);
  logger(withLogContext(formatRuntimeTrace(trace), context), trace);
}

function spanFromRulesTrace(trace: RulesTrace, context: LogContext): OTelSpan {
  const startedMs = Date.parse(trace.startedAt);
  const endedMs = Number.isFinite(startedMs) ? startedMs + trace.durationMs : Date.now();
  return {
    traceId: context.correlationId ? correlationToTraceId(context.correlationId) : generateTraceId(),
    spanId: generateSpanId(),
    name: 'rules.evaluate',
    kind: 'INTERNAL',
    startTimeUnixNano: toUnixNano(Number.isFinite(startedMs) ? startedMs : Date.now() - trace.durationMs),
    endTimeUnixNano: toUnixNano(endedMs),
    attributes: {
      'ruleflow.module': 'rules-engine',
      'ruleflow.tenant_id': context.tenantId ?? 'unknown',
      'ruleflow.user_id': context.userId ?? 'unknown',
      'ruleflow.version_id': context.versionId ?? 'unknown',
      'ruleflow.rules.considered': trace.rulesConsidered.length,
      'ruleflow.rules.matched': trace.rulesMatched.length,
      'ruleflow.rules.errors': trace.errors.length,
    },
    status: trace.errors.length > 0 ? { code: 'ERROR', message: trace.errors[0]?.message } : { code: 'OK' },
  };
}

function spanFromRuntimeTrace(trace: RuntimeTrace, context: LogContext): OTelSpan {
  const startedMs = Date.parse(trace.startedAt);
  const endedMs = Number.isFinite(startedMs) ? startedMs + trace.durationMs : Date.now();
  return {
    traceId: context.correlationId ? correlationToTraceId(context.correlationId) : generateTraceId(),
    spanId: generateSpanId(),
    name: 'runtime.execute_step',
    kind: 'SERVER',
    startTimeUnixNano: toUnixNano(Number.isFinite(startedMs) ? startedMs : Date.now() - trace.durationMs),
    endTimeUnixNano: toUnixNano(endedMs),
    attributes: {
      'ruleflow.module': 'core-runtime',
      'ruleflow.tenant_id': context.tenantId ?? 'unknown',
      'ruleflow.user_id': context.userId ?? 'unknown',
      'ruleflow.version_id': context.versionId ?? 'unknown',
      'ruleflow.flow.from_state': trace.flow.fromStateId,
      'ruleflow.flow.to_state': trace.flow.toStateId,
      'ruleflow.flow.reason': trace.flow.reason,
    },
    status: trace.flow.reason === 'error' ? { code: 'ERROR', message: trace.flow.errorMessage } : { code: 'OK' },
  };
}

function defaultTraceLogger(message: string, trace: unknown): void {
  // eslint-disable-next-line no-console
  console.info(`[RuleFlow] ${message}`, trace);
}

function inferLogContext(trace: unknown, module: string): LogContext {
  const rec = isRecord(trace) ? trace : {};
  const context = isRecord(rec.context) ? rec.context : {};
  const metadata = isRecord(rec.metadata) ? rec.metadata : {};
  const correlationId =
    asString(rec.correlationId) ??
    asString(context.correlationId) ??
    asString(metadata.correlationId) ??
    generateCorrelationId();
  return {
    correlationId,
    tenantId: asString(rec.tenantId) ?? asString(context.tenantId) ?? asString(metadata.tenantId),
    userId: asString(rec.userId) ?? asString(context.userId) ?? asString(metadata.userId),
    versionId: asString(rec.versionId) ?? asString(context.versionId) ?? asString(metadata.versionId),
    module,
  };
}

function withLogContext(message: string, context: LogContext): string {
  const parts = [
    context.module ? `module=${context.module}` : undefined,
    context.tenantId ? `tenant=${context.tenantId}` : undefined,
    context.userId ? `user=${context.userId}` : undefined,
    context.versionId ? `version=${context.versionId}` : undefined,
    context.correlationId ? `correlation=${context.correlationId}` : undefined,
  ].filter(Boolean);
  if (parts.length === 0) return message;
  return `${message} [${parts.join(' ')}]`;
}

function defaultLogLevelResolver(input: LogLevelInput): LogLevel {
  if (typeof process === 'undefined') return 'info';
  const moduleKey = input.module.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const moduleLevel = parseLevel(process.env[`RULEFLOW_LOG_LEVEL_${moduleKey}`]);
  if (moduleLevel) return moduleLevel;
  if (input.tenantId) {
    const tenantKey = input.tenantId.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const tenantLevel = parseLevel(process.env[`RULEFLOW_LOG_LEVEL_TENANT_${tenantKey}`]);
    if (tenantLevel) return tenantLevel;
  }
  return parseLevel(process.env.RULEFLOW_LOG_LEVEL) ?? 'info';
}

function parseLevel(value: string | undefined): LogLevel | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }
  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function generateTraceId(): string {
  return randomHex(16);
}

function generateSpanId(): string {
  return randomHex(8);
}

function generateCorrelationId(): string {
  const webCrypto = getWebCrypto();
  if (webCrypto?.randomUUID) return webCrypto.randomUUID();
  return `${randomHex(4)}-${randomHex(2)}-${randomHex(2)}-${randomHex(2)}-${randomHex(6)}`;
}

function correlationToTraceId(correlationId: string): string {
  // Stable non-cryptographic hash for trace correlation across runtimes.
  return fnv1aHex(correlationId, 32);
}

function toUnixNano(ms: number): string {
  return `${Math.floor(ms * 1_000_000)}`;
}

function attrsToOtel(attributes: Record<string, string | number | boolean> | undefined):
  Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } }> | undefined {
  if (!attributes) return undefined;
  return Object.entries(attributes).map(([key, value]) => {
    if (typeof value === 'string') return { key, value: { stringValue: value } };
    if (typeof value === 'boolean') return { key, value: { boolValue: value } };
    if (Number.isInteger(value)) return { key, value: { intValue: String(value) } };
    return { key, value: { doubleValue: value } };
  });
}

function getWebCrypto(): Crypto | undefined {
  return typeof globalThis !== 'undefined' && 'crypto' in globalThis
    ? (globalThis.crypto as Crypto)
    : undefined;
}

function randomHex(bytes: number): string {
  const webCrypto = getWebCrypto();
  if (webCrypto?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    webCrypto.getRandomValues(arr);
    return Array.from(arr, (v) => v.toString(16).padStart(2, '0')).join('');
  }
  let out = '';
  for (let i = 0; i < bytes; i += 1) {
    out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return out;
}

function fnv1aHex(input: string, length: number): string {
  const seed = [0x811c9dc5, 0x1234567, 0x9e3779b9, 0x85ebca6b];
  const hashes = seed.map((start) => {
    let h = start >>> 0;
    for (let i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }).join('');
  return hashes.slice(0, length).padEnd(length, '0');
}
