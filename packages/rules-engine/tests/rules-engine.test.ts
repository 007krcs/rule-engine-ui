import { describe, expect, it, vi, afterEach } from 'vitest';
import type { ExecutionContext, Rule } from '@platform/schema';
import {
  evaluateRules,
  evaluateCondition,
  configureRulesEngine,
  getRulesEngineConfig,
  resetRulesEngineConfig,
  createActionHandlerRegistry,
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

describe('configurable-limits', () => {
  afterEach(() => {
    resetRulesEngineConfig();
  });

  it('allows configuring default timeout', () => {
    configureRulesEngine({ timeoutMs: 100 });
    const config = getRulesEngineConfig();
    expect(config.timeoutMs).toBe(100);
  });

  it('allows configuring max rules', () => {
    configureRulesEngine({ maxRules: 500 });
    const config = getRulesEngineConfig();
    expect(config.maxRules).toBe(500);
  });

  it('allows configuring max depth', () => {
    configureRulesEngine({ maxDepth: 5 });
    const config = getRulesEngineConfig();
    expect(config.maxDepth).toBe(5);
  });

  it('resets configuration to defaults', () => {
    configureRulesEngine({ timeoutMs: 100, maxRules: 500, maxDepth: 5 });
    resetRulesEngineConfig();
    const config = getRulesEngineConfig();
    expect(config.timeoutMs).toBe(50);
    expect(config.maxRules).toBe(1000);
    expect(config.maxDepth).toBe(10);
  });
});

describe('new-operators', () => {
  it('evaluates isEmpty operator', () => {
    expect(evaluateCondition({ op: 'isEmpty', left: { value: '' } }, baseContext, {})).toBe(true);
    expect(evaluateCondition({ op: 'isEmpty', left: { value: [] } }, baseContext, {})).toBe(true);
    expect(evaluateCondition({ op: 'isEmpty', left: { value: {} } }, baseContext, {})).toBe(true);
    expect(evaluateCondition({ op: 'isEmpty', left: { value: null } }, baseContext, {})).toBe(true);
    expect(evaluateCondition({ op: 'isEmpty', left: { value: 'text' } }, baseContext, {})).toBe(false);
    expect(evaluateCondition({ op: 'isEmpty', left: { value: [1] } }, baseContext, {})).toBe(false);
  });

  it('evaluates isNotEmpty operator', () => {
    expect(evaluateCondition({ op: 'isNotEmpty', left: { value: 'text' } }, baseContext, {})).toBe(true);
    expect(evaluateCondition({ op: 'isNotEmpty', left: { value: [1, 2] } }, baseContext, {})).toBe(true);
    expect(evaluateCondition({ op: 'isNotEmpty', left: { value: '' } }, baseContext, {})).toBe(false);
    expect(evaluateCondition({ op: 'isNotEmpty', left: { value: [] } }, baseContext, {})).toBe(false);
  });

  it('evaluates matches operator with regex', () => {
    expect(evaluateCondition({ op: 'matches', left: { value: 'hello123' }, right: { value: '^hello\\d+$' } }, baseContext, {})).toBe(true);
    expect(evaluateCondition({ op: 'matches', left: { value: 'hello' }, right: { value: '^hello\\d+$' } }, baseContext, {})).toBe(false);
    expect(evaluateCondition({ op: 'matches', left: { value: 'test@example.com' }, right: { value: '.*@.*\\.com$' } }, baseContext, {})).toBe(true);
  });

  it('evaluates length operator', () => {
    expect(evaluateCondition({ op: 'length', left: { value: 'hello' }, right: { value: 5 } }, baseContext, {})).toBe(true);
    expect(evaluateCondition({ op: 'length', left: { value: [1, 2, 3] }, right: { value: 3 } }, baseContext, {})).toBe(true);
    expect(evaluateCondition({ op: 'length', left: { value: 'hi' }, right: { value: 5 } }, baseContext, {})).toBe(false);
  });

  it('evaluates dateOn operator for same day comparison', () => {
    expect(evaluateCondition({ op: 'dateOn', left: { value: '2024-06-15' }, right: { value: '2024-06-15' } }, baseContext, {})).toBe(true);
    expect(evaluateCondition({ op: 'dateOn', left: { value: '2024-06-15T10:00:00Z' }, right: { value: '2024-06-15T23:59:59Z' } }, baseContext, {})).toBe(true);
    expect(evaluateCondition({ op: 'dateOn', left: { value: '2024-06-15' }, right: { value: '2024-06-16' } }, baseContext, {})).toBe(false);
  });
});

describe('transform-actions', () => {
  it('applies math transform - add', () => {
    const result = evaluateRules({
      rules: [
        {
          ruleId: 'MATH_ADD',
          when: { op: 'eq', left: { value: true }, right: { value: true } },
          actions: [{ type: 'transform', path: 'data.value', transform: { type: 'math', expression: 'add', args: { a: 10 } } }],
        },
      ],
      context: baseContext,
      data: { value: 5 },
    });
    expect(result.data.value).toBe(15);
  });

  it('applies math transform - multiply', () => {
    const result = evaluateRules({
      rules: [
        {
          ruleId: 'MATH_MULT',
          when: { op: 'eq', left: { value: true }, right: { value: true } },
          actions: [{ type: 'transform', path: 'data.value', transform: { type: 'math', expression: 'multiply', args: { a: 3 } } }],
        },
      ],
      context: baseContext,
      data: { value: 7 },
    });
    expect(result.data.value).toBe(21);
  });

  it('applies string transform - upper', () => {
    const result = evaluateRules({
      rules: [
        {
          ruleId: 'STRING_UPPER',
          when: { op: 'eq', left: { value: true }, right: { value: true } },
          actions: [{ type: 'transform', path: 'data.name', transform: { type: 'string', expression: 'upper' } }],
        },
      ],
      context: baseContext,
      data: { name: 'hello' },
    });
    expect(result.data.name).toBe('HELLO');
  });

  it('applies string transform - concat', () => {
    const result = evaluateRules({
      rules: [
        {
          ruleId: 'STRING_CONCAT',
          when: { op: 'eq', left: { value: true }, right: { value: true } },
          actions: [{ type: 'transform', path: 'data.greeting', transform: { type: 'string', expression: 'concat', args: { a: ' World!' } } }],
        },
      ],
      context: baseContext,
      data: { greeting: 'Hello' },
    });
    expect(result.data.greeting).toBe('Hello World!');
  });

  it('applies date transform - addDays', () => {
    const result = evaluateRules({
      rules: [
        {
          ruleId: 'DATE_ADD',
          when: { op: 'eq', left: { value: true }, right: { value: true } },
          actions: [{ type: 'transform', path: 'data.dueDate', transform: { type: 'date', expression: 'addDays', args: { days: 7 } } }],
        },
      ],
      context: baseContext,
      data: { dueDate: '2024-01-01' },
    });
    expect(result.data.dueDate).toContain('2024-01-08');
  });

  it('applies template transform', () => {
    const result = evaluateRules({
      rules: [
        {
          ruleId: 'TEMPLATE',
          when: { op: 'eq', left: { value: true }, right: { value: true } },
          actions: [{ type: 'transform', path: 'data.message', transform: { type: 'template', expression: 'Hello {{name}}!', args: { name: 'Alice' } } }],
        },
      ],
      context: baseContext,
      data: { message: '' },
    });
    expect(result.data.message).toBe('Hello Alice!');
  });
});

describe('action-extensibility', () => {
  it('creates custom action handler registry', () => {
    const registry = createActionHandlerRegistry();
    expect(registry.list()).toEqual([]);
  });

  it('registers and invokes custom action handlers', () => {
    const registry = createActionHandlerRegistry();
    const handler = vi.fn();
    registry.register('customAction', handler);

    expect(registry.has('customAction')).toBe(true);
    expect(registry.list()).toContain('customAction');

    const result = evaluateRules({
      rules: [
        {
          ruleId: 'CUSTOM',
          when: { op: 'eq', left: { value: true }, right: { value: true } },
          actions: [{ type: 'custom', handler: 'customAction', args: { foo: 'bar' } }],
        },
      ],
      context: baseContext,
      data: {},
      options: { actionHandlers: registry },
    });

    expect(handler).toHaveBeenCalled();
    expect(result.trace.actionsApplied.length).toBe(1);
  });

  it('prevents overriding built-in actions', () => {
    const registry = createActionHandlerRegistry();
    expect(() => registry.register('setField', vi.fn())).toThrow('Cannot override built-in action type');
    expect(() => registry.register('emitEvent', vi.fn())).toThrow('Cannot override built-in action type');
  });

  it('validates action type names', () => {
    const registry = createActionHandlerRegistry();
    expect(() => registry.register('123invalid', vi.fn())).toThrow('Invalid action type name');
    expect(() => registry.register('valid_action', vi.fn())).not.toThrow();
  });
});

describe('performance-stress-tests', () => {
  it('handles large rule sets efficiently', () => {
    const rules: Rule[] = Array.from({ length: 500 }, (_, i) => ({
      ruleId: `RULE_${i}`,
      priority: i,
      when: { op: 'eq', left: { value: true }, right: { value: true } },
      actions: [{ type: 'setField', path: `data.field_${i}`, value: i }],
    }));

    const start = Date.now();
    const result = evaluateRules({
      rules,
      context: baseContext,
      data: {},
      options: { timeoutMs: 5000, maxRules: 500 },
    });
    const duration = Date.now() - start;

    expect(result.trace.rulesMatched.length).toBe(500);
    expect(duration).toBeLessThan(1000);
  });

  it('respects timeout limits', () => {
    const rules: Rule[] = Array.from({ length: 10000 }, (_, i) => ({
      ruleId: `RULE_${i}`,
      when: { op: 'eq', left: { value: true }, right: { value: true } },
      actions: [{ type: 'setField', path: `data.field_${i}`, value: i }],
    }));

    const result = evaluateRules({
      rules,
      context: baseContext,
      data: {},
      options: { timeoutMs: 10, maxRules: 10000 },
    });

    expect(result.trace.errors.some((e) => e.message.includes('timeout'))).toBe(true);
  });

  it('respects max rules limit', () => {
    const rules: Rule[] = Array.from({ length: 100 }, (_, i) => ({
      ruleId: `RULE_${i}`,
      when: { op: 'eq', left: { value: true }, right: { value: true } },
      actions: [{ type: 'setField', path: `data.field_${i}`, value: i }],
    }));

    const result = evaluateRules({
      rules,
      context: baseContext,
      data: {},
      options: { timeoutMs: 5000, maxRules: 50 },
    });

    expect(result.trace.rulesMatched.length).toBe(50);
    expect(result.trace.errors.some((e) => e.message.includes('Max rules limit'))).toBe(true);
  });
});
