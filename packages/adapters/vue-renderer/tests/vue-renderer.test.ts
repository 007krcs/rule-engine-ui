import { describe, expect, it } from 'vitest';
import type { UISchema } from '@platform/schema';
import { renderVue } from '../src/index';

describe('vue-renderer', () => {
  it('renders HTML output', () => {
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['field'] },
      components: [
        {
          id: 'field',
          type: 'input',
          adapterHint: 'material.input',
          accessibility: { ariaLabelKey: 'runtime.filters.customerName.aria', keyboardNav: true, focusOrder: 1 },
        },
      ],
    };

    const html = renderVue({ uiSchema: schema, data: {} });
    expect(html).toContain('data-ui-page="page"');
  });

  it('throws on accessibility violations', () => {
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['field'] },
      components: [
        {
          id: 'field',
          type: 'input',
          adapterHint: 'material.input',
          accessibility: { ariaLabelKey: '', keyboardNav: false, focusOrder: 0 },
        },
      ],
    };

    expect(() => renderVue({ uiSchema: schema, data: {} })).toThrow('ariaLabelKey is required');
  });
});
