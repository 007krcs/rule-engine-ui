import type { ExecutionContext, FlowSchema, FlowState, FlowTransition, JSONValue } from '@platform/schema';
import type { FlowTrace } from '@platform/observability';
import { evaluateCondition } from '@platform/rules-engine';

export interface TransitionInput {
  flow: FlowSchema;
  stateId: string;
  event: string;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
}

export interface TransitionResult {
  nextStateId: string;
  uiPageId: string;
  actionsToRun: string[];
  apiId?: string;
  trace: FlowTrace;
}

export function transition(input: TransitionInput): TransitionResult {
  const started = Date.now();
  const state = input.flow.states[input.stateId];

  const trace: FlowTrace = {
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    event: input.event,
    fromStateId: input.stateId,
    toStateId: input.stateId,
    uiPageId: state?.uiPageId ?? input.stateId,
    reason: 'error',
    actionsToRun: [],
  };

  if (!state) {
    trace.errorMessage = `Unknown state: ${input.stateId}`;
    trace.durationMs = Date.now() - started;
    return {
      nextStateId: input.stateId,
      uiPageId: trace.uiPageId,
      actionsToRun: [],
      trace,
    };
  }

  const transition = state.on[input.event];
  if (!transition) {
    trace.reason = 'no_transition';
    trace.uiPageId = state.uiPageId;
    trace.durationMs = Date.now() - started;
    return {
      nextStateId: input.stateId,
      uiPageId: state.uiPageId,
      actionsToRun: [],
      trace,
    };
  }

  return applyTransition({ transition, input, trace, started, currentState: state });
}

function applyTransition(params: {
  transition: FlowTransition;
  input: TransitionInput;
  trace: FlowTrace;
  started: number;
  currentState: FlowState;
}): TransitionResult {
  const { transition, input, trace, started, currentState } = params;
  let guardResult = true;
  try {
    if (transition.guard) {
      guardResult = evaluateCondition(transition.guard, input.context, input.data);
      trace.guardResult = guardResult;
    }
  } catch (error) {
    trace.reason = 'error';
    trace.errorMessage = error instanceof Error ? error.message : String(error);
    trace.durationMs = Date.now() - started;
    return {
      nextStateId: input.stateId,
      uiPageId: currentState.uiPageId,
      actionsToRun: [],
      trace,
    };
  }

  if (!guardResult) {
    trace.reason = 'guard_failed';
    trace.uiPageId = currentState.uiPageId;
    trace.durationMs = Date.now() - started;
    return {
      nextStateId: input.stateId,
      uiPageId: trace.uiPageId,
      actionsToRun: [],
      trace,
    };
  }

  const nextStateId = transition.target;
  const nextState = input.flow.states[nextStateId];
  trace.reason = 'ok';
  trace.toStateId = nextStateId;
  trace.actionsToRun = transition.actions ?? [];
  trace.uiPageId = nextState?.uiPageId ?? currentState.uiPageId;
  trace.durationMs = Date.now() - started;

  return {
    nextStateId,
    uiPageId: trace.uiPageId,
    actionsToRun: trace.actionsToRun,
    apiId: transition.apiId,
    trace,
  };
}
