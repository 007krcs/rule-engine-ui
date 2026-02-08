import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExecutionContext, UISchema } from '@platform/schema';
import { createFallbackI18nProvider } from '@platform/i18n';
import { RenderPage } from '@platform/react-renderer';
import { registerCompanyAdapter } from '../src/index';

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

describe('react-company-adapter', () => {
  it('renders metrics and details', () => {
    registerCompanyAdapter();
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'company',
      layout: { id: 'root', type: 'section', componentIds: ['company'] },
      components: [
        {
          id: 'company',
          type: 'card',
          adapterHint: 'company.card',
          props: {
            label: 'Acme Corp',
            metrics: [
              { label: 'ARR', value: '$1.2M' },
              { label: 'Churn', value: '1.4%' },
            ],
            details: { region: 'NA', tier: 'Enterprise' },
          },
          accessibility: { ariaLabelKey: 'runtime.customViz.aria', keyboardNav: true, focusOrder: 1 },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <RenderPage uiSchema={schema} data={{}} context={context} i18n={createFallbackI18nProvider()} />,
    );

    expect(html).toContain('Acme Corp');
    expect(html).toContain('ARR');
  });
});
