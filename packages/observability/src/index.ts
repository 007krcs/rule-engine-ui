import type { RuleAction, JSONValue } from '@platform/schema';

export interface RulesTrace {
  startedAt: string;
  durationMs: number;
  rulesConsidered: string[];
  rulesMatched: string[];
  conditionResults: Record<string, boolean>;
  actionsApplied: Array<{ ruleId: string; action: RuleAction }>;
  events: Array<{ ruleId: string; event: string; payload?: JSONValue }>;
  errors: Array<{ ruleId?: string; message: string }>;
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
}

export type TraceLogger<T> = (message: string, trace: T) => void;

export function formatRulesTrace(trace: RulesTrace): string {
  return `RulesTrace: ${trace.rulesMatched.length}/${trace.rulesConsidered.length} matched in ${trace.durationMs}ms`;
}

export function logRulesTrace(trace: RulesTrace, logger: TraceLogger<RulesTrace> = defaultTraceLogger): void {
  logger(formatRulesTrace(trace), trace);
}

export function formatRuntimeTrace(trace: RuntimeTrace): string {
  const rules = trace.rules ? `${trace.rules.rulesMatched.length} rules matched` : 'rules skipped';
  const api = trace.api ? `api ${trace.api.apiId}` : 'api skipped';
  return `RuntimeTrace: ${trace.flow.reason} in ${trace.durationMs}ms (${rules}, ${api})`;
}

export function logRuntimeTrace(trace: RuntimeTrace, logger: TraceLogger<RuntimeTrace> = defaultTraceLogger): void {
  logger(formatRuntimeTrace(trace), trace);
}

function defaultTraceLogger(message: string, trace: unknown): void {
  // eslint-disable-next-line no-console
  console.info(`[RuleFlow] ${message}`, trace);
}
