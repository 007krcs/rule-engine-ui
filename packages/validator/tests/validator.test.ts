import { describe, expect, it } from 'vitest';
import type { ApiMapping, FlowSchema, RuleSet, UISchema } from '@platform/schema';
import { PLATFORM_BUNDLES } from '@platform/i18n';
import exampleUi from '@platform/schema/examples/example.ui.json';
import exampleFlow from '@platform/schema/examples/example.flow.json';
import exampleRules from '@platform/schema/examples/example.rules.json';
import exampleApi from '@platform/schema/examples/example.api.json';
import {
  validateApiMapping,
  validateAccessibility,
  validateFlowSchema,
  validateI18nCoverage,
  validateRulesSchema,
  validateUISchema,
} from '../src/index';

describe('validator', () => {
  it('validates the example UI schema', () => {
    const schema = exampleUi as unknown as UISchema;
    const result = validateUISchema(schema);
    expect(result.valid).toBe(true);
  });

  it('validates the example flow schema', () => {
    const schema = exampleFlow as unknown as FlowSchema;
    const result = validateFlowSchema(schema);
    expect(result.valid).toBe(true);
  });

  it('validates the example rules schema', () => {
    const schema = exampleRules as unknown as RuleSet;
    const result = validateRulesSchema(schema);
    expect(result.valid).toBe(true);
  });

  it('validates the example api mapping', () => {
    const schema = exampleApi as unknown as ApiMapping;
    const result = validateApiMapping(schema);
    expect(result.valid).toBe(true);
  });

  it('flags accessibility violations', () => {
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'invalid',
      layout: { id: 'root', type: 'section', componentIds: ['field'] },
      components: [
        {
          id: 'field',
          type: 'input',
          adapterHint: 'material.input',
          accessibility: {
            ariaLabelKey: '',
            keyboardNav: false,
            focusOrder: 0,
          },
        },
      ],
    };
    const result = validateAccessibility(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('detects missing translations', () => {
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'missing-i18n',
      layout: { id: 'root', type: 'section', componentIds: ['field'] },
      components: [
        {
          id: 'field',
          type: 'input',
          adapterHint: 'material.input',
          i18n: { labelKey: 'runtime.missing.label' },
          accessibility: {
            ariaLabelKey: 'runtime.missing.aria',
            keyboardNav: true,
            focusOrder: 1,
          },
        },
      ],
    };

    const result = validateI18nCoverage(schema, {
      locales: ['en'],
      bundles: PLATFORM_BUNDLES,
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain('Missing translation');
  });
});
