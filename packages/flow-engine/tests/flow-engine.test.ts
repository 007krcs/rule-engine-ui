import { describe, expect, it } from 'vitest';
import type { ExecutionContext, FlowSchema } from '@platform/schema';
import { transition } from '../src/index';

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
});
