import { describe, expect, it } from 'vitest';
import {
  apiMappingSchema,
  executionContextSchema,
  flowSchema,
  rulesSchema,
  uiSchema,
} from '../src/index';

function readSchemaId(schema: unknown): string | undefined {
  if (typeof schema !== 'object' || schema === null || !('$id' in schema)) return undefined;
  const id = (schema as { $id?: unknown }).$id;
  return typeof id === 'string' ? id : undefined;
}

describe('schema assets', () => {
  it('exports the json schemas', () => {
    expect(executionContextSchema).toBeTruthy();
    expect(uiSchema).toBeTruthy();
    expect(flowSchema).toBeTruthy();
    expect(rulesSchema).toBeTruthy();
    expect(apiMappingSchema).toBeTruthy();

    expect(readSchemaId(executionContextSchema)).toBe('execution-context.schema.json');
    expect(readSchemaId(uiSchema)).toBe('ui.schema.json');
    expect(readSchemaId(flowSchema)).toBe('flow.schema.json');
    expect(readSchemaId(rulesSchema)).toBe('rules.schema.json');
    expect(readSchemaId(apiMappingSchema)).toBe('api-mapping.schema.json');
  });
});
