import type {
  ApiMapping,
  ExecutionContext,
  FlowSchema,
  JSONValue,
  Rule,
  UISchema,
} from '@platform/schema';
import type { RuntimeTrace } from '@platform/observability';
import { transition } from '@platform/flow-engine';
import { evaluateRules } from '@platform/rules-engine';
import { callApi } from '@platform/api-orchestrator';

export interface ExecuteStepInput {
  flow: FlowSchema;
  uiSchemasById: Record<string, UISchema>;
  rules: Rule[];
  apiMappingsById: Record<string, ApiMapping>;
  stateId: string;
  event: string;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
  fetchFn?: typeof fetch;
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

  const flowResult = transition({
    flow: input.flow,
    stateId: input.stateId,
    event: input.event,
    context: input.context,
    data: input.data,
  });

  let updatedData = input.data;
  let updatedContext = input.context;
  let rulesTrace = undefined;
  let apiTrace = undefined;

  if (flowResult.actionsToRun.includes('evaluateRules')) {
    const rulesResult = evaluateRules({
      rules: input.rules,
      context: updatedContext,
      data: updatedData,
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

  return {
    nextStateId: flowResult.nextStateId,
    uiSchema,
    updatedContext,
    updatedData,
    trace,
  };
}
