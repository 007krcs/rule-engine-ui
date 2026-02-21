import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, Rule } from '@platform/schema';
import {
  clearRuleActionHandlers,
  configureRulesEngine,
  createMemoizedConditionEvaluator,
  evaluateCondition,
  evaluateRules,
  registerRuleActionHandler,
  resetRulesEngineConfig,
} from '../src/index';

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
  it('supports locale-aware date aliases and plusDays', () => {
    const context: ExecutionContext = { ...baseContext, locale: 'en-US' };
    const result = evaluateRules({
      rules: [
        {
          ruleId: 'DATE_ON',
          when: { op: 'on', left: { value: '12/31/2024' }, right: { value: '2024-12-31' } },
          actions: [{ type: 'setField', path: 'data.on', value: true }],
        },
        {
          ruleId: 'DATE_BEFORE_ALIAS',
          when: { op: 'before', left: { value: '12/01/2024' }, right: { value: '2024-12-15' } },
          actions: [{ type: 'setField', path: 'data.beforeAlias', value: true }],
        },
        {
          ruleId: 'DATE_PLUS_DAYS',
          when: { op: 'plusDays', left: { value: '2024-01-08' }, right: { value: { date: '2024-01-01', days: 7 } } },
          actions: [{ type: 'setField', path: 'data.plusDays', value: true }],
        },
      ],
      context,
      data: {},
    });
    expect(result.data.on).toBe(true);
    expect(result.data.beforeAlias).toBe(true);
    expect(result.data.plusDays).toBe(true);
  });

  it('supports safe transform operands', () => {
    expect(
      evaluateCondition(
        {
          op: 'eq',
          left: { value: { $transform: 'add', args: [2, 3, { $path: 'data.offset' }] } },
          right: { value: 10 },
        },
        baseContext,
        { offset: 5 },
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        {
          op: 'eq',
          left: { value: { $transform: 'lower', args: [' AbC '] } },
          right: { value: 'abc' },
        },
        baseContext,
        {},
      ),
    ).toBe(false);

    expect(
      evaluateCondition(
        {
          op: 'eq',
          left: { value: { $transform: 'trim', args: [' AbC '] } },
          right: { value: 'AbC' },
        },
        baseContext,
        {},
      ),
    ).toBe(true);
  });

  it('allows secure custom actions via whitelist and registry', () => {
    resetRulesEngineConfig();
    clearRuleActionHandlers();
    registerRuleActionHandler('setAuditFlag', (action, ctx) => {
      const value = (action as { value?: unknown }).value;
      ctx.data.audit = value === undefined ? true : (value as never);
    });

    configureRulesEngine({
      actionPolicy: { allowCustomActions: true, allowedActionTypes: ['setAuditFlag'] },
    });

    const result = evaluateRules({
      rules: [
        {
          ruleId: 'CUSTOM_ACTION',
          when: { op: 'eq', left: { value: true }, right: { value: true } },
          actions: [{ type: 'setAuditFlag', value: 'ok' } as Rule['actions'][number]],
        },
      ],
      context: baseContext,
      data: {},
    });

    expect(result.data.audit).toBe('ok');
    expect(result.trace.errors).toHaveLength(0);

    resetRulesEngineConfig();
    clearRuleActionHandlers();
  });

  it('rejects custom actions that are not whitelisted', () => {
    resetRulesEngineConfig();
    clearRuleActionHandlers();
    registerRuleActionHandler('customThing', () => undefined);
    configureRulesEngine({
      actionPolicy: { allowCustomActions: true, allowedActionTypes: ['anotherAction'] },
    });

    const result = evaluateRules({
      rules: [
        {
          ruleId: 'CUSTOM_ACTION_BLOCKED',
          when: { op: 'eq', left: { value: true }, right: { value: true } },
          actions: [{ type: 'customThing' } as Rule['actions'][number]],
        },
      ],
      context: baseContext,
      data: {},
    });

    expect(result.trace.errors.some((error) => error.message.includes('Action not allowed by policy'))).toBe(true);

    resetRulesEngineConfig();
    clearRuleActionHandlers();
  });

  it('supports configurable limits through runtime config', () => {
    resetRulesEngineConfig();
    configureRulesEngine({ limits: { maxRules: 1 } });
    const result = evaluateRules({
      rules: [
        { ruleId: 'ONE', when: { op: 'eq', left: { value: true }, right: { value: true } } },
        { ruleId: 'TWO', when: { op: 'eq', left: { value: true }, right: { value: true } } },
      ],
      context: baseContext,
      data: {},
    });

    expect(result.trace.errors.some((error) => error.message.includes('Max rules limit reached'))).toBe(true);
    resetRulesEngineConfig();
  });

  it('supports configurable limits through environment variables', () => {
    resetRulesEngineConfig();
    const previous = process.env.RULEFLOW_RULES_MAX_RULES;
    process.env.RULEFLOW_RULES_MAX_RULES = '1';
    const result = evaluateRules({
      rules: [
        { ruleId: 'ONE', when: { op: 'eq', left: { value: true }, right: { value: true } } },
        { ruleId: 'TWO', when: { op: 'eq', left: { value: true }, right: { value: true } } },
      ],
      context: baseContext,
      data: {},
    });
    expect(result.trace.errors.some((error) => error.message.includes('Max rules limit reached'))).toBe(true);
    process.env.RULEFLOW_RULES_MAX_RULES = previous;
    resetRulesEngineConfig();
  });

  it('supports configurable performance policy through environment variables', () => {
    resetRulesEngineConfig();
    const prevPathCache = process.env.RULEFLOW_RULES_PATH_CACHE_SIZE;
    const prevMemo = process.env.RULEFLOW_RULES_CONDITION_MEMO_SIZE;
    const prevMemoEnabled = process.env.RULEFLOW_RULES_MEMOIZE_CONDITIONS;
    process.env.RULEFLOW_RULES_PATH_CACHE_SIZE = '64';
    process.env.RULEFLOW_RULES_CONDITION_MEMO_SIZE = '128';
    process.env.RULEFLOW_RULES_MEMOIZE_CONDITIONS = '1';
    const result = evaluateRules({
      rules: [{ ruleId: 'ONE', when: { op: 'eq', left: { value: true }, right: { value: true } } }],
      context: baseContext,
      data: {},
    });
    expect(result.trace.rulesMatched).toContain('ONE');
    process.env.RULEFLOW_RULES_PATH_CACHE_SIZE = prevPathCache;
    process.env.RULEFLOW_RULES_CONDITION_MEMO_SIZE = prevMemo;
    process.env.RULEFLOW_RULES_MEMOIZE_CONDITIONS = prevMemoEnabled;
    resetRulesEngineConfig();
  });

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

  it('memoized condition evaluator returns stable results', () => {
    const evalMemo = createMemoizedConditionEvaluator({ cacheSize: 16 });
    const condition = {
      op: 'eq',
      left: { path: 'data.status' },
      right: { value: 'ok' },
    } as const;
    expect(evalMemo(condition, baseContext, { status: 'ok' })).toBe(true);
    expect(evalMemo(condition, baseContext, { status: 'ok' })).toBe(true);
    expect(evalMemo(condition, baseContext, { status: 'nope' })).toBe(false);
  });

  it('invalidates rule condition memo between mutating actions', () => {
    const result = evaluateRules({
      rules: [
        {
          ruleId: 'SET_FLAG',
          priority: 2,
          when: { op: 'eq', left: { path: 'data.flag' }, right: { value: false } },
          actions: [{ type: 'setField', path: 'data.flag', value: true }],
        },
        {
          ruleId: 'SHOULD_SKIP',
          priority: 1,
          when: { op: 'eq', left: { path: 'data.flag' }, right: { value: false } },
          actions: [{ type: 'setField', path: 'data.shouldSkip', value: true }],
        },
      ],
      context: baseContext,
      data: { flag: false },
      options: { memoizeConditionEvaluations: true },
    });
    expect(result.data.flag).toBe(true);
    expect(result.data.shouldSkip).toBeUndefined();
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
