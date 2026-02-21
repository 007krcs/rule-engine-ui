import type {
  ExecutionContext,
  FlowForkConfig,
  FlowSchema,
  FlowState,
  FlowTransition,
  FlowTransitionHistoryCondition,
  JSONValue,
} from '@platform/schema';
import type { FlowTrace } from '@platform/observability';
import { emitBusinessMetric } from '@platform/observability';
import { evaluateCondition } from '@platform/rules-engine';

export interface TransitionInput {
  flow: FlowSchema;
  stateId: string;
  event: string;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
  history?: string[];
}

export interface TransitionResult {
  nextStateId: string;
  uiPageId: string;
  actionsToRun: string[];
  apiId?: string;
  trace: FlowTrace;
}

interface TransitionCandidate {
  key: string;
  sourceStateId: string;
  transition: FlowTransition;
  onEvent: string;
}

export interface FlowTimerEntry {
  id: string;
  stateId: string;
  transitionKey: string;
  dueAt: number;
}

export interface FlowParallelContext {
  id: string;
  joinType: 'and' | 'or';
  joinState: string;
  branches: string[];
  completedBranches: string[];
}

export interface FlowSession {
  activeStateIds: string[];
  history: string[];
  timers: FlowTimerEntry[];
  parallelContexts: FlowParallelContext[];
  nowMs: number;
}

export interface CreateFlowSessionInput {
  flow: FlowSchema;
  initialStateId?: string;
  nowMs?: number;
}

export interface StepFlowSessionInput {
  flow: FlowSchema;
  session: FlowSession;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
  event?: string;
  nowMs?: number;
}

export interface StepFlowSessionResult {
  session: FlowSession;
  traces: FlowTrace[];
  actionsToRun: string[];
  apiIds: string[];
  enteredStateIds: string[];
  exitedStateIds: string[];
}

export interface FlowBreakpoint {
  stateId?: string;
  event?: string;
}

export interface FlowDebuggerSnapshot {
  index: number;
  event?: string;
  nowMs: number;
  session: FlowSession;
  traces: FlowTrace[];
}

export interface FlowDebuggerStepResult {
  snapshot: FlowDebuggerSnapshot;
  halted: boolean;
  hitBreakpoints: FlowBreakpoint[];
}

export class FlowDebugger {
  private snapshots: FlowDebuggerSnapshot[];
  private pointer: number;
  private breakpoints: FlowBreakpoint[] = [];

  constructor(
    private readonly flow: FlowSchema,
    private readonly context: ExecutionContext,
    private readonly data: Record<string, JSONValue>,
    initialSession = createFlowSession({ flow }),
  ) {
    this.snapshots = [
      {
        index: 0,
        event: undefined,
        nowMs: initialSession.nowMs,
        session: cloneSession(initialSession),
        traces: [],
      },
    ];
    this.pointer = 0;
  }

  addBreakpoint(breakpoint: FlowBreakpoint): void {
    this.breakpoints.push(breakpoint);
  }

  clearBreakpoints(): void {
    this.breakpoints = [];
  }

  step(event?: string, nowMs?: number): FlowDebuggerStepResult {
    const current = cloneSession(this.snapshots[this.pointer]?.session ?? createFlowSession({ flow: this.flow }));
    const result = stepFlowSession({
      flow: this.flow,
      session: current,
      context: this.context,
      data: this.data,
      event,
      nowMs,
    });
    const snapshot: FlowDebuggerSnapshot = {
      index: this.snapshots.length,
      event,
      nowMs: result.session.nowMs,
      session: cloneSession(result.session),
      traces: result.traces,
    };
    this.snapshots.push(snapshot);
    this.pointer = snapshot.index;

    const hitBreakpoints = this.breakpoints.filter((bp) =>
      result.traces.some((trace) => {
        const stateMatch = !bp.stateId || bp.stateId === trace.fromStateId || bp.stateId === trace.toStateId;
        const eventMatch = !bp.event || bp.event === trace.event;
        return stateMatch && eventMatch;
      }),
    );

    return {
      snapshot,
      halted: hitBreakpoints.length > 0,
      hitBreakpoints,
    };
  }

  timeTravel(index: number): FlowDebuggerSnapshot {
    const bounded = Math.max(0, Math.min(index, this.snapshots.length - 1));
    const snapshot = this.snapshots[bounded];
    if (!snapshot) {
      throw new Error(`Snapshot index ${index} is not available.`);
    }
    this.pointer = bounded;
    return {
      ...snapshot,
      session: cloneSession(snapshot.session),
      traces: [...snapshot.traces],
    };
  }

  getTimeline(): FlowDebuggerSnapshot[] {
    return this.snapshots.map((snapshot) => ({
      ...snapshot,
      session: cloneSession(snapshot.session),
      traces: [...snapshot.traces],
    }));
  }
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
    emitFlowMetrics(trace, input.context.tenantId);
    return {
      nextStateId: input.stateId,
      uiPageId: trace.uiPageId,
      actionsToRun: [],
      trace,
    };
  }

  const decision = resolveTransitionForState({
    flow: input.flow,
    stateId: input.stateId,
    event: input.event,
    context: input.context,
    data: input.data,
    history: input.history ?? [input.stateId],
  });

  if (!decision.candidate) {
    trace.reason = decision.reason;
    trace.uiPageId = state.uiPageId;
    trace.errorMessage = decision.errorMessage;
    trace.durationMs = Date.now() - started;
    emitFlowMetrics(trace, input.context.tenantId);
    return {
      nextStateId: input.stateId,
      uiPageId: state.uiPageId,
      actionsToRun: [],
      trace,
    };
  }

  const transitionDef = decision.candidate.transition;
  const nextStateId = transitionDef.target;
  const nextState = input.flow.states[nextStateId];

  trace.reason = 'ok';
  trace.guardResult = true;
  trace.toStateId = nextStateId;
  trace.actionsToRun = transitionDef.actions ?? [];
  trace.uiPageId = nextState?.uiPageId ?? state.uiPageId;
  trace.durationMs = Date.now() - started;
  emitFlowMetrics(trace, input.context.tenantId);

  return {
    nextStateId,
    uiPageId: trace.uiPageId,
    actionsToRun: trace.actionsToRun,
    apiId: transitionDef.apiId,
    trace,
  };
}

export function createFlowSession(input: CreateFlowSessionInput): FlowSession {
  const initialStateId =
    input.initialStateId ??
    (input.flow.states[input.flow.initialState] ? input.flow.initialState : Object.keys(input.flow.states)[0] ?? '');
  const nowMs = input.nowMs ?? Date.now();
  const baseSession: FlowSession = {
    activeStateIds: initialStateId ? [initialStateId] : [],
    history: initialStateId ? [initialStateId] : [],
    timers: [],
    parallelContexts: [],
    nowMs,
  };

  if (initialStateId) {
    scheduleTimersForState(input.flow, baseSession, initialStateId, nowMs);
  }

  return baseSession;
}

export function stepFlowSession(input: StepFlowSessionInput): StepFlowSessionResult {
  const nowMs = input.nowMs ?? Date.now();
  const session = cloneSession(input.session);
  session.nowMs = nowMs;

  const traces: FlowTrace[] = [];
  const actionsToRun: string[] = [];
  const apiIds: string[] = [];
  const enteredStateIds: string[] = [];
  const exitedStateIds: string[] = [];

  processDueTimers({ flow: input.flow, session, context: input.context, data: input.data, traces, actionsToRun, apiIds, enteredStateIds, exitedStateIds });

  if (input.event) {
    const stateOrder = [...session.activeStateIds].sort((a, b) => a.localeCompare(b));
    for (const stateId of stateOrder) {
      const started = Date.now();
      const state = input.flow.states[stateId];
      if (!state) continue;
      const baseTrace = createBaseTrace(stateId, input.event, started, state.uiPageId);
      const decision = resolveTransitionForState({
        flow: input.flow,
        stateId,
        event: input.event,
        context: input.context,
        data: input.data,
        history: session.history,
      });

      if (!decision.candidate) {
        if (decision.reason === 'no_transition') continue;
        baseTrace.reason = decision.reason;
        baseTrace.errorMessage = decision.errorMessage;
        baseTrace.durationMs = Date.now() - started;
        traces.push(baseTrace);
        continue;
      }

      const apply = applyTransitionDecision({
        flow: input.flow,
        session,
        context: input.context,
        data: input.data,
        sourceStateId: stateId,
        candidate: decision.candidate,
        event: input.event,
        started,
      });
      traces.push(apply.trace);
      actionsToRun.push(...apply.actionsToRun);
      if (apply.apiId) apiIds.push(apply.apiId);
      enteredStateIds.push(...apply.enteredStateIds);
      exitedStateIds.push(...apply.exitedStateIds);
    }
  }

  session.activeStateIds = uniqueSorted(session.activeStateIds);

  return {
    session,
    traces,
    actionsToRun,
    apiIds,
    enteredStateIds: uniqueSorted(enteredStateIds),
    exitedStateIds: uniqueSorted(exitedStateIds),
  };
}

function emitFlowMetrics(trace: FlowTrace, tenantId: string): void {
  emitBusinessMetric({
    name: 'flow.transition.duration_ms',
    value: trace.durationMs,
    unit: 'ms',
    attributes: {
      tenant_id: tenantId,
      event: trace.event,
      from_state: trace.fromStateId,
      to_state: trace.toStateId,
      reason: trace.reason,
    },
  });
  emitBusinessMetric({
    name: 'flow.transition.count',
    value: 1,
    attributes: {
      tenant_id: tenantId,
      reason: trace.reason,
    },
  });
}

function processDueTimers(params: {
  flow: FlowSchema;
  session: FlowSession;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
  traces: FlowTrace[];
  actionsToRun: string[];
  apiIds: string[];
  enteredStateIds: string[];
  exitedStateIds: string[];
}): void {
  let guard = 0;
  while (guard < 1000) {
    guard += 1;
    const due = params.session.timers
      .filter((timer) => timer.dueAt <= params.session.nowMs)
      .sort((a, b) => a.dueAt - b.dueAt || a.stateId.localeCompare(b.stateId) || a.transitionKey.localeCompare(b.transitionKey));

    if (due.length === 0) break;

    for (const timer of due) {
      removeTimer(params.session, timer.id);
      if (!params.session.activeStateIds.includes(timer.stateId)) continue;
      const state = params.flow.states[timer.stateId];
      if (!state) continue;
      const started = Date.now();
      const candidate = resolveTimerCandidate(state, timer.transitionKey, timer.stateId);
      if (!candidate) continue;

      const apply = applyTransitionDecision({
        flow: params.flow,
        session: params.session,
        context: params.context,
        data: params.data,
        sourceStateId: timer.stateId,
        candidate,
        event: '__timer__',
        started,
      });

      params.traces.push(apply.trace);
      params.actionsToRun.push(...apply.actionsToRun);
      if (apply.apiId) params.apiIds.push(apply.apiId);
      params.enteredStateIds.push(...apply.enteredStateIds);
      params.exitedStateIds.push(...apply.exitedStateIds);
    }
  }
}

function applyTransitionDecision(params: {
  flow: FlowSchema;
  session: FlowSession;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
  sourceStateId: string;
  candidate: TransitionCandidate;
  event: string;
  started: number;
}): {
  trace: FlowTrace;
  actionsToRun: string[];
  apiId?: string;
  enteredStateIds: string[];
  exitedStateIds: string[];
} {
  const { flow, session, sourceStateId, candidate, event, started } = params;
  const sourceState = flow.states[sourceStateId];
  const trace = createBaseTrace(sourceStateId, event, started, sourceState?.uiPageId ?? sourceStateId);

  if (!sourceState) {
    trace.reason = 'error';
    trace.errorMessage = `Unknown state: ${sourceStateId}`;
    trace.durationMs = Date.now() - started;
    return { trace, actionsToRun: [], enteredStateIds: [], exitedStateIds: [] };
  }

  const transitionDef = candidate.transition;
  const exitedStateIds: string[] = [];
  const enteredStateIds: string[] = [];

  removeActiveState(session, sourceStateId);
  exitedStateIds.push(sourceStateId);
  removeTimersForState(session, sourceStateId);

  if (transitionDef.fork) {
    const fork = normalizeFork(transitionDef.fork);
    const contextId = fork.id || `${sourceStateId}:${candidate.key}:${session.nowMs}`;
    session.parallelContexts.push({
      id: contextId,
      joinType: fork.joinType,
      joinState: fork.joinState,
      branches: uniqueSorted(fork.branches),
      completedBranches: [],
    });

    for (const branchState of fork.branches) {
      if (!flow.states[branchState]) continue;
      addActiveState(session, branchState);
      enteredStateIds.push(branchState);
      session.history.push(branchState);
      scheduleTimersForState(flow, session, branchState, session.nowMs);
    }

    trace.reason = 'ok';
    trace.guardResult = true;
    trace.toStateId = fork.branches.join('|');
    trace.uiPageId = flow.states[fork.branches[0] ?? '']?.uiPageId ?? sourceState.uiPageId;
    trace.actionsToRun = transitionDef.actions ?? [];
    trace.durationMs = Date.now() - started;

    return {
      trace,
      actionsToRun: transitionDef.actions ?? [],
      apiId: transitionDef.apiId,
      enteredStateIds,
      exitedStateIds,
    };
  }

  const targetStateId = transitionDef.target;
  const joinResult = maybeResolveParallelJoin(flow, session, sourceStateId, targetStateId, enteredStateIds, exitedStateIds);
  if (!joinResult.handled) {
    if (flow.states[targetStateId]) {
      addActiveState(session, targetStateId);
      enteredStateIds.push(targetStateId);
      session.history.push(targetStateId);
      scheduleTimersForState(flow, session, targetStateId, session.nowMs);
    }
  }

  trace.reason = 'ok';
  trace.guardResult = true;
  trace.toStateId = joinResult.joinStateId ?? targetStateId;
  trace.actionsToRun = transitionDef.actions ?? [];
  trace.uiPageId = flow.states[trace.toStateId]?.uiPageId ?? sourceState.uiPageId;
  trace.durationMs = Date.now() - started;

  return {
    trace,
    actionsToRun: transitionDef.actions ?? [],
    apiId: transitionDef.apiId,
    enteredStateIds,
    exitedStateIds,
  };
}

function maybeResolveParallelJoin(
  flow: FlowSchema,
  session: FlowSession,
  branchStateId: string,
  targetStateId: string,
  enteredStateIds: string[],
  exitedStateIds: string[],
): { handled: boolean; joinStateId?: string } {
  const contexts = session.parallelContexts.filter((ctx) => ctx.branches.includes(branchStateId));
  if (contexts.length === 0) return { handled: false };

  for (const context of contexts) {
    if (targetStateId !== context.joinState) {
      return { handled: false };
    }

    if (!context.completedBranches.includes(branchStateId)) {
      context.completedBranches.push(branchStateId);
    }

    if (context.joinType === 'or') {
      for (const remaining of context.branches) {
        if (remaining !== branchStateId && session.activeStateIds.includes(remaining)) {
          removeActiveState(session, remaining);
          removeTimersForState(session, remaining);
          exitedStateIds.push(remaining);
        }
      }
      addActiveState(session, context.joinState);
      enteredStateIds.push(context.joinState);
      session.history.push(context.joinState);
      scheduleTimersForState(flow, session, context.joinState, session.nowMs);
      session.parallelContexts = session.parallelContexts.filter((entry) => entry.id !== context.id);
      return { handled: true, joinStateId: context.joinState };
    }

    const complete = context.branches.every((branch) => context.completedBranches.includes(branch));
    if (complete) {
      addActiveState(session, context.joinState);
      enteredStateIds.push(context.joinState);
      session.history.push(context.joinState);
      scheduleTimersForState(flow, session, context.joinState, session.nowMs);
      session.parallelContexts = session.parallelContexts.filter((entry) => entry.id !== context.id);
      return { handled: true, joinStateId: context.joinState };
    }

    return { handled: true };
  }

  return { handled: false };
}

function resolveTransitionForState(input: {
  flow: FlowSchema;
  stateId: string;
  event: string;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
  history: string[];
}): {
  candidate?: TransitionCandidate;
  reason: FlowTrace['reason'];
  errorMessage?: string;
} {
  const state = input.flow.states[input.stateId];
  if (!state) {
    return { reason: 'error', errorMessage: `Unknown state: ${input.stateId}` };
  }

  const candidates = getCandidatesForEvent(state, input.stateId, input.event).sort(sortCandidates);
  if (candidates.length === 0) {
    return { reason: 'no_transition' };
  }

  let hadGuardFailure = false;
  for (const candidate of candidates) {
    if (!matchesHistory(candidate.transition.history, input.history)) {
      hadGuardFailure = true;
      continue;
    }
    try {
      if (!candidate.transition.guard) {
        return { candidate, reason: 'ok' };
      }
      const passed = evaluateCondition(candidate.transition.guard, input.context, input.data);
      if (passed) {
        return { candidate, reason: 'ok' };
      }
      hadGuardFailure = true;
    } catch (error) {
      return {
        reason: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return { reason: hadGuardFailure ? 'guard_failed' : 'no_transition' };
}

function getCandidatesForEvent(state: FlowState, stateId: string, event: string): TransitionCandidate[] {
  const candidates: TransitionCandidate[] = [];
  const transitionFromOn = state.on[event];
  if (transitionFromOn) {
    candidates.push({
      key: `on:${event}`,
      sourceStateId: stateId,
      transition: {
        ...transitionFromOn,
        onEvent: event,
      },
      onEvent: event,
    });
  }

  const list = state.transitions ?? [];
  for (let index = 0; index < list.length; index += 1) {
    const transition = list[index];
    if (!transition) continue;
    if (transition.onEvent !== event) continue;
    candidates.push({
      key: `tx:${index}`,
      sourceStateId: stateId,
      transition,
      onEvent: event,
    });
  }

  return candidates;
}

function resolveTimerCandidate(state: FlowState, transitionKey: string, stateId: string): TransitionCandidate | undefined {
  if (!transitionKey.startsWith('tx:')) return undefined;
  const index = Number(transitionKey.slice('tx:'.length));
  if (!Number.isInteger(index) || index < 0) return undefined;
  const transition = state.transitions?.[index];
  if (!transition) return undefined;
  if (transition.delayMs === undefined || transition.delayMs < 0) return undefined;
  return {
    key: transitionKey,
    sourceStateId: stateId,
    transition,
    onEvent: transition.onEvent ?? '__timer__',
  };
}

function sortCandidates(left: TransitionCandidate, right: TransitionCandidate): number {
  const priorityDiff = (right.transition.priority ?? 0) - (left.transition.priority ?? 0);
  if (priorityDiff !== 0) return priorityDiff;
  const weightDiff = (right.transition.weight ?? 0) - (left.transition.weight ?? 0);
  if (weightDiff !== 0) return weightDiff;
  return left.key.localeCompare(right.key);
}

function matchesHistory(condition: FlowTransitionHistoryCondition | undefined, history: string[]): boolean {
  if (!condition) return true;
  const visited = new Set(history);
  if (condition.hasVisitedAll && !condition.hasVisitedAll.every((stateId) => visited.has(stateId))) {
    return false;
  }
  if (condition.hasVisitedAny && !condition.hasVisitedAny.some((stateId) => visited.has(stateId))) {
    return false;
  }
  if (condition.notVisited && condition.notVisited.some((stateId) => visited.has(stateId))) {
    return false;
  }
  return true;
}

function scheduleTimersForState(flow: FlowSchema, session: FlowSession, stateId: string, nowMs: number): void {
  const state = flow.states[stateId];
  if (!state) return;
  const transitions = state.transitions ?? [];
  for (let index = 0; index < transitions.length; index += 1) {
    const transition = transitions[index];
    if (!transition || transition.delayMs === undefined || transition.delayMs < 0) continue;
    const transitionKey = `tx:${index}`;
    const id = `${stateId}:${transitionKey}`;
    if (session.timers.some((timer) => timer.id === id)) continue;
    session.timers.push({
      id,
      stateId,
      transitionKey,
      dueAt: nowMs + transition.delayMs,
    });
  }
}

function removeTimersForState(session: FlowSession, stateId: string): void {
  session.timers = session.timers.filter((timer) => timer.stateId !== stateId);
}

function removeTimer(session: FlowSession, timerId: string): void {
  session.timers = session.timers.filter((timer) => timer.id !== timerId);
}

function addActiveState(session: FlowSession, stateId: string): void {
  if (!session.activeStateIds.includes(stateId)) {
    session.activeStateIds.push(stateId);
  }
}

function removeActiveState(session: FlowSession, stateId: string): void {
  session.activeStateIds = session.activeStateIds.filter((value) => value !== stateId);
}

function normalizeFork(fork: FlowForkConfig): Required<FlowForkConfig> {
  return {
    id: fork.id ?? '',
    branches: uniqueSorted(fork.branches),
    joinType: fork.joinType ?? 'and',
    joinState: fork.joinState,
  };
}

function createBaseTrace(stateId: string, event: string, started: number, uiPageId: string): FlowTrace {
  return {
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    event,
    fromStateId: stateId,
    toStateId: stateId,
    uiPageId,
    reason: 'error',
    actionsToRun: [],
  };
}

function cloneSession(session: FlowSession): FlowSession {
  return {
    activeStateIds: [...session.activeStateIds],
    history: [...session.history],
    timers: session.timers.map((timer) => ({ ...timer })),
    parallelContexts: session.parallelContexts.map((context) => ({
      ...context,
      branches: [...context.branches],
      completedBranches: [...context.completedBranches],
    })),
    nowMs: session.nowMs,
  };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
