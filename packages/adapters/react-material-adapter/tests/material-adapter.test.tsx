import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExecutionContext, UISchema } from '@platform/schema';
import { createFallbackI18nProvider } from '@platform/i18n';
import { createAdapterRegistry, RenderPage } from '@platform/react-renderer';
import { registerMaterialAdapters } from '../src/index';

const context: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'admin',
  roles: ['admin'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
  device: 'desktop',
  permissions: [],
  featureFlags: {},
};

describe('react-material-adapter', () => {
  it('renders material.input as MUI TextField and material.button as MUI Button', () => {
    const adapterRegistry = createAdapterRegistry();
    registerMaterialAdapters(adapterRegistry);
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'stack', componentIds: ['input', 'button'] },
      components: [
        {
          id: 'input',
          type: 'input',
          adapterHint: 'material.input',
          i18n: {
            labelKey: 'runtime.filters.customerName.label',
            placeholderKey: 'runtime.filters.customerName.placeholder',
          },
          accessibility: { ariaLabelKey: 'runtime.filters.customerName.aria', keyboardNav: true, focusOrder: 1 },
        },
        {
          id: 'button',
          type: 'button',
          adapterHint: 'material.button',
          i18n: { labelKey: 'runtime.orders.table.label' },
          accessibility: { ariaLabelKey: 'runtime.orders.table.aria', keyboardNav: true, focusOrder: 2 },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <RenderPage
        uiSchema={schema}
        data={{}}
        context={context}
        i18n={createFallbackI18nProvider()}
        adapterRegistry={adapterRegistry}
      />,
    );

    expect(html).toContain('MuiTextField-root');
    expect(html).toContain('data-mui-component="material-text-field"');
    expect(html).toContain('data-mui-component="material-button"');
  });
});
