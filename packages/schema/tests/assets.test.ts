import { describe, expect, it } from 'vitest';
import {
  apiMappingSchema,
  executionContextSchema,
  flowSchema,
  rulesSchema,
  uiSchema,
} from '../src/index';

describe('schema assets', () => {
  it('exports the json schemas', () => {
    expect(executionContextSchema).toBeTruthy();
    expect(uiSchema).toBeTruthy();
    expect(flowSchema).toBeTruthy();
    expect(rulesSchema).toBeTruthy();
    expect(apiMappingSchema).toBeTruthy();

    expect((executionContextSchema as any).$id).toBe('execution-context.schema.json');
    expect((uiSchema as any).$id).toBe('ui.schema.json');
    expect((flowSchema as any).$id).toBe('flow.schema.json');
    expect((rulesSchema as any).$id).toBe('rules.schema.json');
    expect((apiMappingSchema as any).$id).toBe('api-mapping.schema.json');
  });
});
