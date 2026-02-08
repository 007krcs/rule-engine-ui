import { describe, expect, it } from 'vitest';
import type { UISchema } from '@platform/schema';
import { PLATFORM_BUNDLES } from '@platform/i18n';
import exampleUi from '@platform/schema/examples/example.ui.json';
import {
  validateAccessibility,
  validateI18nCoverage,
  validateUISchema,
} from '../src/index';

describe('validator', () => {
  it('validates the example UI schema', () => {
    const schema = exampleUi as unknown as UISchema;
    const result = validateUISchema(schema);
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
