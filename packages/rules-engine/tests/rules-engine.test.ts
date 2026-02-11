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
      options: { timeoutMs: 1000 },
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

  it('captures explain details (per-clause results, reads, action diffs)', () => {
    const result = evaluateRules({
      rules: [
        {
          ruleId: 'EXPLAIN',
          when: { op: 'gt', left: { path: 'data.total' }, right: { value: 100 } },
          actions: [{ type: 'setField', path: 'data.segment', value: 'vip' }],
        },
      ],
      context: baseContext,
      data: { total: 120 },
    });

    const explain = result.trace.conditionExplains?.EXPLAIN;
    expect(explain).toBeTruthy();
    expect(explain?.kind).toBe('compare');
    expect(explain && 'result' in explain ? explain.result : null).toBe(true);
    expect(explain && 'left' in explain ? explain.left.kind : null).toBe('path');
    expect(explain && 'left' in explain && explain.left.kind === 'path' ? explain.left.path : null).toBe('data.total');
    expect(explain && 'left' in explain && explain.left.kind === 'path' ? explain.left.value : null).toBe(120);

    const reads = result.trace.readsByRuleId?.EXPLAIN ?? [];
    expect(reads.some((r) => r.path === 'data.total' && r.value === 120)).toBe(true);

    const diffs = (result.trace.actionDiffs ?? []).filter((d) => d.ruleId === 'EXPLAIN');
    expect(diffs.length).toBeGreaterThan(0);
    expect(
      diffs.some(
        (d) => d.target === 'data' && d.path === 'segment' && d.before === undefined && d.after === 'vip' && d.action.type === 'setField',
      ),
    ).toBe(true);
  });

  it('evaluates date operators', () => {
    const rules: Rule[] = [
      {
        ruleId: 'DATE_BEFORE',
        when: { op: 'dateBefore', left: { path: 'data.orderDate' }, right: { value: '2024-12-01' } },
        actions: [{ type: 'setField', path: 'data.before', value: true }],
      },
      {
        ruleId: 'DATE_AFTER',
        when: { op: 'dateAfter', left: { path: 'data.orderDate' }, right: { value: '2024-01-01' } },
        actions: [{ type: 'setField', path: 'data.after', value: true }],
      },
      {
        ruleId: 'DATE_BETWEEN',
        when: { op: 'dateBetween', left: { path: 'data.orderDate' }, right: { value: ['2024-01-01', '2024-12-31'] } },
        actions: [{ type: 'setField', path: 'data.between', value: true }],
      },
    ];

    const result = evaluateRules({
      rules,
      context: baseContext,
      data: { orderDate: '2024-06-15' },
    });

    expect(result.data.before).toBe(true);
    expect(result.data.after).toBe(true);
    expect(result.data.between).toBe(true);
  });

  it('returns false for invalid date values', () => {
    expect(
      evaluateCondition(
        { op: 'dateBefore', left: { value: 'not-a-date' }, right: { value: '2024-01-01' } },
        baseContext,
        {},
      ),
    ).toBe(false);

    expect(
      evaluateCondition(
        { op: 'dateAfter', left: { value: '2024-01-01' }, right: { value: 'bad-date' } },
        baseContext,
        {},
      ),
    ).toBe(false);
  });
});
