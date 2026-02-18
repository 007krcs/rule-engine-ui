import { describe, expect, it } from 'vitest';
import type { ApiMapping, FlowSchema } from '@platform/schema';
import {
  createDefaultApiMapping,
  normalizeFlowSchema,
  parseJsonText,
  validateApiMappingsById,
  validateFlowBuilderSchema,
} from '@/lib/builder/flow-api-validators';

describe('flow-api-validators', () => {
  it('normalizes missing flow to a default state', () => {
    const normalized = normalizeFlowSchema(null, 'page-main');
    expect(normalized.initialState).toBe('start');
    expect(normalized.states.start?.uiPageId).toBe('page-main');
  });

  it('validates target references and orphan states', () => {
    const flow: FlowSchema = {
      version: '1.0.0',
      flowId: 'test',
      initialState: 'start',
      states: {
        start: {
          uiPageId: 'page-a',
          on: {
            next: { target: 'missing' },
          },
        },
        review: {
          uiPageId: 'page-a',
          on: {},
        },
      },
    };

    const issues = validateFlowBuilderSchema(flow, ['page-a']);
    expect(
      issues.some((issue) => issue.path.includes('start.on.next.target') && issue.severity === 'error'),
    ).toBe(true);
    expect(
      issues.some((issue) => issue.path.includes('states.review') && issue.severity === 'warning'),
    ).toBe(true);
  });

  it('validates api mappings and catches duplicate api ids', () => {
    const one = createDefaultApiMapping('submitOrder');
    const two: ApiMapping = {
      ...createDefaultApiMapping('submitOrder'),
      endpoint: 'https://api.example.com/orders/second',
    };

    const issues = validateApiMappingsById({
      submitOrder: one,
      submitOrderCopy: two,
    });

    expect(issues.some((issue) => issue.message.includes('already used'))).toBe(true);
  });

  it('parses primitive json-ish input', () => {
    expect(parseJsonText('true')).toBe(true);
    expect(parseJsonText('42')).toBe(42);
    expect(parseJsonText('"hello"')).toBe('hello');
  });
});
