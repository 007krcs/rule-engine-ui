import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, Rule } from '@platform/schema';
import { evaluateRules, evaluateCondition } from '../src/index';

const baseContext: ExecutionContext = {
  tenantId: 'tenant-a',
  userId: 'user-1',
  role: 'admin',
  roles: ['admin'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
  device: 'desktop',
  permissions: ['read'],
  featureFlags: { demo: true },
};

describe('rules-engine', () => {
  it('applies scoped rules in deterministic order', () => {
    const rules: Rule[] = [
      {
        ruleId: 'B_RULE',
        priority: 10,
        scope: { countries: ['US'], roles: ['admin'] },
        when: { op: 'gt', left: { path: 'data.total' }, right: { value: 100 } },
        actions: [{ type: 'setField', path: 'data.discount', value: 0.2 }],
      },
      {
        ruleId: 'A_RULE',
        priority: 10,
        scope: { countries: ['US'], roles: ['admin'] },
        when: { op: 'gt', left: { path: 'data.total' }, right: { value: 50 } },
        actions: [{ type: 'setField', path: 'data.segment', value: 'vip' }],
      },
    ];

    const result = evaluateRules({
      rules,
      context: baseContext,
      data: { total: 120 },
    });

    expect(result.trace.rulesConsidered).toEqual(['A_RULE', 'B_RULE']);
    expect(result.data.segment).toBe('vip');
    expect(result.data.discount).toBe(0.2);
  });

  it('records events and stops on throwError', () => {
    const rules: Rule[] = [
      {
        ruleId: 'EMIT',
        priority: 5,
        when: { op: 'eq', left: { value: true }, right: { value: true } },
        actions: [{ type: 'emitEvent', event: 'ping', payload: { source: 'rule' } }],
      },
      {
        ruleId: 'BLOCK',
        priority: 1,
        when: { op: 'eq', left: { value: true }, right: { value: true } },
        actions: [{ type: 'throwError', message: 'stop', code: 'STOP' }],
      },
      {
        ruleId: 'AFTER',
        priority: 0,
        when: { op: 'eq', left: { value: true }, right: { value: true } },
        actions: [{ type: 'setField', path: 'data.after', value: true }],
      },
    ];

    const result = evaluateRules({ rules, context: baseContext, data: {} });

    expect(result.trace.events).toHaveLength(1);
    expect(result.trace.errors.length).toBeGreaterThan(0);
    expect(result.data.after).toBeUndefined();
  });

  it('evaluates predicate conditions', () => {
    const condition = {
      all: [
        { op: 'exists', left: { path: 'context.locale' } },
        { op: 'contains', left: { value: 'platform' }, right: { value: 'form' } },
      ],
    } as const;

    const result = evaluateCondition(condition, baseContext, { ok: true });
    expect(result).toBe(true);
  });

  it('records depth errors for overly nested conditions', () => {
    const nested = { not: { not: { not: { op: 'exists', left: { path: 'data.value' } } } } } as const;
    const result = evaluateRules({
      rules: [
        {
          ruleId: 'DEPTH',
          when: nested,
          actions: [{ type: 'setField', path: 'data.ok', value: true }],
        },
      ],
      context: baseContext,
      data: {},
      options: { maxDepth: 1 },
    });
    expect(result.trace.errors.length).toBeGreaterThan(0);
    expect(result.data.ok).toBeUndefined();
  });

  it('invokes trace logger when enabled', () => {
    let captured = '';
    const result = evaluateRules({
      rules: [
        {
          ruleId: 'LOG',
          when: { op: 'exists', left: { path: 'context.locale' } },
        },
      ],
      context: baseContext,
      data: {},
      options: {
        traceLogger: (trace) => {
          captured = trace.startedAt;
        },
      },
    });
    expect(captured).toBe(result.trace.startedAt);
  });

  it('logs via provided logger when logTrace is set', () => {
    const logger = vi.fn();
    evaluateRules({
      rules: [
        {
          ruleId: 'LOGGING',
          when: { op: 'exists', left: { path: 'context.locale' } },
        },
      ],
      context: baseContext,
      data: {},
      options: {
        logTrace: true,
        logger,
      },
    });
    expect(logger).toHaveBeenCalled();
  });
});
