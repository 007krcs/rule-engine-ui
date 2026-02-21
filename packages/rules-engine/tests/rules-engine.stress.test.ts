import { describe, expect, it } from 'vitest';
import type { ExecutionContext, Rule } from '@platform/schema';
import { evaluateRules } from '../src/index';

const context: ExecutionContext = {
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

function buildRules(count: number): Rule[] {
  return Array.from({ length: count }, (_, index) => ({
    ruleId: `RULE_${String(index).padStart(5, '0')}`,
    priority: count - index,
    when: { op: 'eq', left: { value: true }, right: { value: true } },
    actions: [{ type: 'setField', path: `data.r${index}`, value: index }],
  }));
}

describe('rules-engine stress', () => {
  it('handles large rulesets with configurable limit guard', () => {
    const rules = buildRules(5000);
    const result = evaluateRules({
      rules,
      context,
      data: {},
      options: { maxRules: 1000, timeoutMs: 5000 },
    });

    expect(result.trace.rulesConsidered).toHaveLength(5000);
    expect(result.trace.rulesMatched.length).toBeLessThanOrEqual(1000);
    expect(result.trace.errors.some((error) => error.message.includes('Max rules limit reached: 1000'))).toBe(true);
  });
});
