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
  const shouldValidate = input.validate ?? process.env.RULEFLOW_VALIDATE !== '0';

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

  const flowResult = transition({
    flow: input.flow,
    stateId: input.stateId,
    event: input.event,
    context: input.context,
    data: input.data,
  });

  let updatedData = input.data;
  let updatedContext = input.context;
  let rulesTrace: RulesTrace | undefined;
  let apiTrace: RuntimeTrace['api'] | undefined;

  if (flowResult.actionsToRun.includes('evaluateRules')) {
    const rulesResult = evaluateRules({
      rules: input.rules,
      context: updatedContext,
      data: updatedData,
      options: {
        logTrace: input.logTraces,
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
  };

  if (input.traceLogger) {
    input.traceLogger(trace);
  }
  if (input.logTraces || process.env.RULEFLOW_TRACE === '1') {
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
