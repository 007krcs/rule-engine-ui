import { describe, expect, it } from 'vitest';
import type { RuleCondition } from '@platform/schema';
import {
  actionToRule,
  conditionFromRule,
  conditionToRule,
  draftsToRuleSet,
  parseValueText,
  rulesToDrafts,
  type ActionDraft,
} from '../src/components/rules/rule-visual-model';
import { rulesVisualFixtureContext, rulesVisualFixtureData } from './fixtures/rules-visual.fixture';

describe('rules visual model serialization', () => {
  it('serializes nested all/any/not condition trees', () => {
    const source: RuleCondition = {
      all: [
        { op: 'eq', left: { path: 'context.country' }, right: { value: 'US' } },
        {
          any: [
            { op: 'exists', left: { path: 'data.customerName' } },
            { not: { op: 'gt', left: { path: 'data.orderTotal' }, right: { value: 5000 } } },
          ],
        },
      ],
    };

    const draft = conditionFromRule(source);
    const serialized = conditionToRule(draft);
    expect(serialized).toEqual(source);
  });

  it('parses literal values from visual input text', () => {
    expect(parseValueText('true')).toBe(true);
    expect(parseValueText('42')).toBe(42);
    expect(parseValueText('"US"')).toBe('US');
    expect(parseValueText('{"a":1}')).toEqual({ a: 1 });
    expect(parseValueText('hello')).toBe('hello');
  });

  it('serializes action drafts correctly', () => {
    const action: ActionDraft = {
      id: 'a-1',
      type: 'setField',
      path: 'data.submitDisabled',
      valueText: 'true',
    };
    expect(actionToRule(action)).toEqual({
      type: 'setField',
      path: 'data.submitDisabled',
      value: true,
    });
  });

  it('round-trips rulesets between schema and visual drafts', () => {
    const source = {
      version: '1.0.0',
      rules: [
        {
          ruleId: 'DISABLE_SUBMIT_UNTIL_CUSTOMER',
          description: 'Disable submit until customerName exists',
          priority: 100,
          scope: {
            countries: [rulesVisualFixtureContext.country],
            roles: [rulesVisualFixtureContext.role],
          },
          when: {
            not: {
              op: 'exists',
              left: { path: 'data.customerName' },
            },
          },
          actions: [
            {
              type: 'setField',
              path: 'data.submitDisabled',
              value: !Boolean(rulesVisualFixtureData.customerName),
            },
          ],
        },
      ],
    };

    const drafts = rulesToDrafts(source);
    const serialized = draftsToRuleSet('1.0.0', drafts);
    expect(serialized).toEqual(source);
  });
});
