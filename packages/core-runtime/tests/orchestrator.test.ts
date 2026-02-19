import { describe, expect, it } from 'vitest';
import { buildExecutionQueue, createExecutionPlan } from '../src/orchestrator';

describe('orchestrator helpers', () => {
  it('de-duplicates and normalizes requested steps', () => {
    const queue = buildExecutionQueue([' validate ', 'evaluateRules', 'validate', '', 'callApi']);

    expect(queue).toEqual(['validate', 'evaluateRules', 'callApi']);
  });

  it('creates an execution plan and removes disabled steps', () => {
    const plan = createExecutionPlan(['validate', 'evaluateRules', 'callApi'], ['callApi']);

    expect(plan.queue).toEqual(['validate', 'evaluateRules']);
    expect(plan.skipped).toEqual(['callApi']);
  });
});
