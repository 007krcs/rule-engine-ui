import { describe, expect, it } from 'vitest';
import type { ApiMapping, FlowSchema, RuleSet, UISchema } from '@platform/schema';
import {
  validateApiMapping,
  validateFlowSchema,
  validateRulesSchema,
  validateUISchema,
} from '@platform/validator';
import exampleUi from '../examples/example.ui.json';
import exampleFlow from '../examples/example.flow.json';
import exampleRules from '../examples/example.rules.json';
import exampleApi from '../examples/example.api.json';

describe('schema examples', () => {
  it('passes validator for UI schema', () => {
    const result = validateUISchema(exampleUi as unknown as UISchema);
    expect(result.valid).toBe(true);
  });

  it('passes validator for flow schema', () => {
    const result = validateFlowSchema(exampleFlow as unknown as FlowSchema);
    expect(result.valid).toBe(true);
  });

  it('passes validator for rules schema', () => {
    const result = validateRulesSchema(exampleRules as unknown as RuleSet);
    expect(result.valid).toBe(true);
  });

  it('passes validator for api mapping', () => {
    const result = validateApiMapping(exampleApi as unknown as ApiMapping);
    expect(result.valid).toBe(true);
  });
});
