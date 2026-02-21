import { performance } from 'node:perf_hooks';
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
    ruleId: `BENCH_${index}`,
    priority: count - index,
    when: { op: 'eq', left: { path: 'data.kind' }, right: { value: 'bench' } },
    actions: [{ type: 'setField', path: `data.out.${index}`, value: index }],
  }));
}

function runScenario(
  name: string,
  rules: Rule[],
  options: {
    timeoutMs: number;
    maxRules: number;
    maxDepth: number;
    memoizeConditionEvaluations?: boolean;
    memoCacheSize?: number;
  },
): void {
  const started = performance.now();
  const result = evaluateRules({
    rules,
    context,
    data: { kind: 'bench', out: {} },
    options,
  });
  const durationMs = performance.now() - started;
  process.stdout.write(
    `${name.padEnd(16)} duration=${durationMs.toFixed(2)}ms matched=${result.trace.rulesMatched.length} errors=${result.trace.errors.length}\n`,
  );
}

function main(): void {
  const rules = buildRules(10000);
  process.stdout.write('rules-engine benchmark (10k rules)\n');
  runScenario('balanced', rules, { timeoutMs: 2500, maxRules: 10000, maxDepth: 10 });
  runScenario('memo-on', rules, {
    timeoutMs: 2500,
    maxRules: 10000,
    maxDepth: 10,
    memoizeConditionEvaluations: true,
    memoCacheSize: 4096,
  });
  runScenario('memo-off', rules, {
    timeoutMs: 2500,
    maxRules: 10000,
    maxDepth: 10,
    memoizeConditionEvaluations: false,
  });
  runScenario('tight-rules', rules, { timeoutMs: 2500, maxRules: 1000, maxDepth: 10 });
  runScenario('tight-timeout', rules, { timeoutMs: 5, maxRules: 10000, maxDepth: 10 });
  runScenario('deep-guard', rules, { timeoutMs: 2500, maxRules: 10000, maxDepth: 3 });
}

main();
