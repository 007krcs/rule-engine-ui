import { describe, expect, it } from 'vitest';
import type { ExecutionContext, FlowSchema } from '@platform/schema';
import { FlowDebugger, createFlowSession, stepFlowSession, transition } from '../src/index';

const context: ExecutionContext = {
  tenantId: 't1',
  userId: 'u1',
  role: 'user',
  roles: ['user'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/Los_Angeles',
  device: 'desktop',
  permissions: [],
  featureFlags: {},
};

const flow: FlowSchema = {
  version: '1.0.0',
  flowId: 'demo',
  initialState: 'start',
  states: {
    start: {
      uiPageId: 'page-start',
      on: {
        next: {
          target: 'review',
          guard: {
            op: 'eq',
            left: { path: 'data.ready' },
            right: { value: true },
          },
          actions: ['evaluateRules'],
        },
      },
    },
    review: {
      uiPageId: 'page-review',
      on: {
        back: { target: 'start' },
      },
    },
  },
};

describe('flow-engine', () => {
  it('transitions when guard passes', () => {
    const result = transition({
      flow,
      stateId: 'start',
      event: 'next',
      context,
      data: { ready: true },
    });

    expect(result.nextStateId).toBe('review');
    expect(result.actionsToRun).toEqual(['evaluateRules']);
  });

  it('blocks transition when guard fails', () => {
    const result = transition({
      flow,
      stateId: 'start',
      event: 'next',
      context,
      data: { ready: false },
    });

    expect(result.nextStateId).toBe('start');
    expect(result.trace.reason).toBe('guard_failed');
  });

  it('returns no_transition when event missing', () => {
    const result = transition({
      flow,
      stateId: 'start',
      event: 'unknown',
      context,
      data: {},
    });

    expect(result.nextStateId).toBe('start');
    expect(result.trace.reason).toBe('no_transition');
  });

  it('returns error when state is unknown', () => {
    const result = transition({
      flow,
      stateId: 'missing',
      event: 'next',
      context,
      data: {},
    });

    expect(result.trace.reason).toBe('error');
    expect(result.trace.errorMessage).toContain('Unknown state');
  });

  it('resolves transitions by priority then weight deterministically', () => {
    const weightedFlow: FlowSchema = {
      version: '1.0.0',
      flowId: 'weighted',
      initialState: 's1',
      states: {
        s1: {
          uiPageId: 's1-page',
          on: {},
          transitions: [
            { onEvent: 'go', target: 'low', priority: 1, weight: 99 },
            { onEvent: 'go', target: 'high', priority: 5, weight: 1 },
            { onEvent: 'go', target: 'mid', priority: 5, weight: 10 },
          ],
        },
        low: { uiPageId: 'low-page', on: {} },
        high: { uiPageId: 'high-page', on: {} },
        mid: { uiPageId: 'mid-page', on: {} },
      },
    };

    const result = transition({
      flow: weightedFlow,
      stateId: 's1',
      event: 'go',
      context,
      data: {},
    });

    expect(result.nextStateId).toBe('mid');
  });

  it('supports parallel fork/join with AND semantics', () => {
    const parallelFlow: FlowSchema = {
      version: '1.0.0',
      flowId: 'parallel-and',
      initialState: 'start',
      states: {
        start: {
          uiPageId: 'start',
          on: {},
          transitions: [
            {
              onEvent: 'begin',
              target: 'noop',
              fork: {
                id: 'fork-1',
                branches: ['branchA', 'branchB'],
                joinType: 'and',
                joinState: 'joined',
              },
            },
          ],
        },
        branchA: {
          uiPageId: 'branchA',
          on: {
            doneA: { target: 'joined' },
          },
        },
        branchB: {
          uiPageId: 'branchB',
          on: {
            doneB: { target: 'joined' },
          },
        },
        joined: { uiPageId: 'joined', on: {} },
        noop: { uiPageId: 'noop', on: {} },
      },
    };

    let session = createFlowSession({ flow: parallelFlow, nowMs: 100 });
    const begin = stepFlowSession({
      flow: parallelFlow,
      session,
      context,
      data: {},
      event: 'begin',
      nowMs: 100,
    });
    session = begin.session;
    expect(session.activeStateIds).toEqual(['branchA', 'branchB']);

    const completeA = stepFlowSession({
      flow: parallelFlow,
      session,
      context,
      data: {},
      event: 'doneA',
      nowMs: 110,
    });
    session = completeA.session;
    expect(session.activeStateIds).toEqual(['branchB']);

    const completeB = stepFlowSession({
      flow: parallelFlow,
      session,
      context,
      data: {},
      event: 'doneB',
      nowMs: 120,
    });
    session = completeB.session;
    expect(session.activeStateIds).toEqual(['joined']);
  });

  it('supports OR join semantics', () => {
    const flowOr: FlowSchema = {
      version: '1.0.0',
      flowId: 'parallel-or',
      initialState: 'start',
      states: {
        start: {
          uiPageId: 'start',
          on: {},
          transitions: [
            {
              onEvent: 'begin',
              target: 'noop',
              fork: {
                branches: ['branchA', 'branchB'],
                joinType: 'or',
                joinState: 'joined',
              },
            },
          ],
        },
        branchA: { uiPageId: 'branchA', on: { done: { target: 'joined' } } },
        branchB: { uiPageId: 'branchB', on: { done: { target: 'joined' } } },
        joined: { uiPageId: 'joined', on: {} },
        noop: { uiPageId: 'noop', on: {} },
      },
    };

    let session = createFlowSession({ flow: flowOr, nowMs: 1 });
    session = stepFlowSession({ flow: flowOr, session, context, data: {}, event: 'begin', nowMs: 1 }).session;
    expect(session.activeStateIds).toEqual(['branchA', 'branchB']);

    session = stepFlowSession({ flow: flowOr, session, context, data: {}, event: 'done', nowMs: 2 }).session;
    expect(session.activeStateIds).toEqual(['joined']);
  });

  it('supports history-aware branching', () => {
    const flowHistory: FlowSchema = {
      version: '1.0.0',
      flowId: 'history',
      initialState: 'start',
      states: {
        start: { uiPageId: 'start', on: { next: { target: 'middle' } } },
        middle: {
          uiPageId: 'middle',
          on: {},
          transitions: [
            {
              onEvent: 'route',
              target: 'vip',
              history: { hasVisitedAll: ['start'] },
              priority: 2,
            },
            {
              onEvent: 'route',
              target: 'standard',
              priority: 1,
            },
          ],
        },
        vip: { uiPageId: 'vip', on: {} },
        standard: { uiPageId: 'standard', on: {} },
      },
    };

    let session = createFlowSession({ flow: flowHistory, nowMs: 1 });
    session = stepFlowSession({ flow: flowHistory, session, context, data: {}, event: 'next', nowMs: 2 }).session;
    session = stepFlowSession({ flow: flowHistory, session, context, data: {}, event: 'route', nowMs: 3 }).session;

    expect(session.activeStateIds).toEqual(['vip']);
  });

  it('executes time-based transitions without external timers', () => {
    const timedFlow: FlowSchema = {
      version: '1.0.0',
      flowId: 'timed',
      initialState: 'wait',
      states: {
        wait: {
          uiPageId: 'wait',
          on: {},
          transitions: [{ target: 'expired', delayMs: 1000 }],
        },
        expired: { uiPageId: 'expired', on: {} },
      },
    };

    let session = createFlowSession({ flow: timedFlow, nowMs: 0 });
    session = stepFlowSession({ flow: timedFlow, session, context, data: {}, nowMs: 500 }).session;
    expect(session.activeStateIds).toEqual(['wait']);

    session = stepFlowSession({ flow: timedFlow, session, context, data: {}, nowMs: 1000 }).session;
    expect(session.activeStateIds).toEqual(['expired']);
  });

  it('supports debugger breakpoints and time-travel', () => {
    const debuggerFlow: FlowSchema = {
      version: '1.0.0',
      flowId: 'debugger',
      initialState: 'start',
      states: {
        start: { uiPageId: 'start', on: { next: { target: 'review' } } },
        review: { uiPageId: 'review', on: { finish: { target: 'done' } } },
        done: { uiPageId: 'done', on: {} },
      },
    };

    const debuggerSession = new FlowDebugger(debuggerFlow, context, {});
    debuggerSession.addBreakpoint({ stateId: 'review' });

    const first = debuggerSession.step('next', 10);
    expect(first.halted).toBe(true);
    expect(first.snapshot.session.activeStateIds).toEqual(['review']);

    const second = debuggerSession.step('finish', 20);
    expect(second.snapshot.session.activeStateIds).toEqual(['done']);

    const rewind = debuggerSession.timeTravel(1);
    expect(rewind.session.activeStateIds).toEqual(['review']);
  });
});
