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
