import type {
  ApiMapping,
  ExecutionContext,
  FlowSchema,
  JSONValue,
  Rule,
  RuleSet,
  UISchema,
} from '@platform/schema';
import { logRuntimeTrace, type RulesTrace, type RuntimeTrace } from '@platform/observability';
import { transition } from '@platform/flow-engine';
import { evaluateRules } from '@platform/rules-engine';
import { callApi } from '@platform/api-orchestrator';
import { assertApiMapping, assertFlowSchema, assertRulesSchema, assertUISchema } from '@platform/validator';

export interface ExecuteStepInput {
  flow: FlowSchema;
  uiSchemasById: Record<string, UISchema>;
  rules: Rule[] | RuleSet;
  apiMappingsById: Record<string, ApiMapping>;
  stateId: string;
  event: string;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
  fetchFn?: typeof fetch;
  validate?: boolean;
  logTraces?: boolean;
  traceLogger?: (trace: RuntimeTrace) => void;
  ruleTraceLogger?: (trace: RulesTrace) => void;
  correlationId?: string;
  versionId?: string;
  killSwitch?: {
    active: boolean;
    reason?: string;
  };
  eventFilter?: (input: {
    event: string;
    data: Record<string, JSONValue>;
    context: ExecutionContext;
  }) => {
    event: string;
    data: Record<string, JSONValue>;
    context: ExecutionContext;
  };
  accessControl?: {
    tenantId?: string;
    allowedEvents?: string[];
    allowedUiPageIds?: string[];
    allowedApiIds?: string[];
    requiredRolesByUiPageId?: Record<string, string[]>;
    requiredRolesByApiId?: Record<string, string[]>;
  };
  resolveSecret?: (input: { secretRef: string; tenantId: string; context: ExecutionContext }) => Promise<string | undefined> | string | undefined;
}

export interface ExecuteStepResult {
  nextStateId: string;
  uiSchema: UISchema;
  updatedContext: ExecutionContext;
  updatedData: Record<string, JSONValue>;
  trace: RuntimeTrace;
}

export async function executeStep(input: ExecuteStepInput): Promise<ExecuteStepResult> {
  const started = Date.now();
  // `executeStep` runs in both Node and browsers. Guard `process.env` for client bundles.
  const validateEnv = typeof process !== 'undefined' ? process.env.RULEFLOW_VALIDATE : undefined;
  const shouldValidate = input.validate ?? validateEnv !== '0';

  if (shouldValidate) {
    assertFlowSchema(input.flow);
    for (const schema of Object.values(input.uiSchemasById)) {
      assertUISchema(schema);
    }
    const ruleSet: RuleSet = Array.isArray(input.rules)
      ? { version: 'runtime', rules: input.rules }
      : input.rules;
    assertRulesSchema(ruleSet);
    for (const mapping of Object.values(input.apiMappingsById)) {
      assertApiMapping(mapping);
    }
  }

  if (input.killSwitch?.active) {
    const reason = input.killSwitch.reason?.trim();
    throw new Error(reason ? `Execution blocked by kill switch: ${reason}` : 'Execution blocked by kill switch');
  }

  const filtered = (input.eventFilter ?? defaultEventFilter)({
    event: input.event,
    data: input.data,
    context: input.context,
  });
  enforceAccessControl({
    access: input.accessControl,
    context: filtered.context,
    event: filtered.event,
  });

  const flowResult = transition({
    flow: input.flow,
    stateId: input.stateId,
    event: filtered.event,
    context: filtered.context,
    data: filtered.data,
  });

  enforceAccessControl({
    access: input.accessControl,
    context: filtered.context,
    uiPageId: flowResult.uiPageId,
    apiId: flowResult.apiId,
  });

  let updatedData = filtered.data;
  let updatedContext = filtered.context;
  let rulesTrace: RulesTrace | undefined;
  let apiTrace: RuntimeTrace['api'] | undefined;

  if (flowResult.actionsToRun.includes('evaluateRules')) {
    const rulesResult = evaluateRules({
      rules: input.rules,
      context: updatedContext,
      data: updatedData,
      options: {
        logTrace: input.logTraces,
        correlationId: input.correlationId,
        versionId: input.versionId,
        traceLogger: (trace) => input.ruleTraceLogger?.(trace),
      },
    });
    updatedData = rulesResult.data;
    updatedContext = rulesResult.context;
    rulesTrace = rulesResult.trace;
  }

  if (flowResult.actionsToRun.includes('callApi')) {
    const apiId = flowResult.apiId;
    if (apiId && input.apiMappingsById[apiId]) {
      const apiResult = await callApi({
        mapping: input.apiMappingsById[apiId],
        context: updatedContext,
        data: updatedData,
        fetchFn: input.fetchFn,
        options: {
          resolveSecret: input.resolveSecret,
          correlationId: input.correlationId,
        },
      });
      updatedData = apiResult.data;
      updatedContext = apiResult.context;
      apiTrace = apiResult.trace;
    }
  }

  const uiSchema = input.uiSchemasById[flowResult.uiPageId];
  if (!uiSchema) {
    throw new Error(`UISchema not found for pageId: ${flowResult.uiPageId}`);
  }
  const trace: RuntimeTrace = {
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    flow: flowResult.trace,
    rules: rulesTrace,
    api: apiTrace,
    context: {
      correlationId: input.correlationId,
      tenantId: updatedContext.tenantId,
      userId: updatedContext.userId,
      versionId: input.versionId,
    },
  };

  if (input.traceLogger) {
    input.traceLogger(trace);
  }
  const traceEnv = typeof process !== 'undefined' ? process.env.RULEFLOW_TRACE : undefined;
  if (input.logTraces || traceEnv === '1') {
    logRuntimeTrace(trace);
  }

  return {
    nextStateId: flowResult.nextStateId,
    uiSchema,
    updatedContext,
    updatedData,
    trace,
  };
}

function defaultEventFilter(input: {
  event: string;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
}): {
  event: string;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
} {
  return {
    event: sanitizeString(input.event, 128),
    data: sanitizeObject(input.data),
    context: sanitizeObject(input.context as unknown as Record<string, JSONValue>) as unknown as ExecutionContext,
  };
}

function sanitizeObject(value: Record<string, JSONValue>): Record<string, JSONValue> {
  const out: Record<string, JSONValue> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!key || isUnsafeKey(key)) continue;
    out[key] = sanitizeValue(raw, 0);
  }
  return out;
}

function sanitizeValue(value: JSONValue, depth: number): JSONValue {
  if (depth > 12) return null;
  if (value === null) return null;
  if (typeof value === 'string') return sanitizeString(value, 4096);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 256).map((entry) => sanitizeValue(entry, depth + 1));
  return sanitizeObject(value as Record<string, JSONValue>);
}

function sanitizeString(value: string, maxLength: number): string {
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function enforceAccessControl(input: {
  access: ExecuteStepInput['accessControl'];
  context: ExecutionContext;
  event?: string;
  uiPageId?: string;
  apiId?: string;
}): void {
  const access = input.access;
  if (!access) return;
  if (access.tenantId && input.context.tenantId !== access.tenantId) {
    throw new Error(`Access denied: tenant mismatch (${input.context.tenantId}).`);
  }
  if (input.event && access.allowedEvents && access.allowedEvents.length > 0 && !access.allowedEvents.includes(input.event)) {
    throw new Error(`Access denied: event "${input.event}" is not allowed.`);
  }
  if (input.uiPageId && access.allowedUiPageIds && access.allowedUiPageIds.length > 0 && !access.allowedUiPageIds.includes(input.uiPageId)) {
    throw new Error(`Access denied: ui page "${input.uiPageId}" is not allowed.`);
  }
  if (input.apiId && access.allowedApiIds && access.allowedApiIds.length > 0 && !access.allowedApiIds.includes(input.apiId)) {
    throw new Error(`Access denied: api "${input.apiId}" is not allowed.`);
  }
  if (input.uiPageId) {
    const required = access.requiredRolesByUiPageId?.[input.uiPageId] ?? [];
    if (required.length > 0 && !required.some((role) => input.context.roles.includes(role) || input.context.role === role)) {
      throw new Error(`Access denied: missing role for ui page "${input.uiPageId}".`);
    }
  }
  if (input.apiId) {
    const required = access.requiredRolesByApiId?.[input.apiId] ?? [];
    if (required.length > 0 && !required.some((role) => input.context.roles.includes(role) || input.context.role === role)) {
      throw new Error(`Access denied: missing role for api "${input.apiId}".`);
    }
  }
}

function isUnsafeKey(value: string): boolean {
  return value === '__proto__' || value === 'constructor' || value === 'prototype';
}

export * from './orchestrator';
