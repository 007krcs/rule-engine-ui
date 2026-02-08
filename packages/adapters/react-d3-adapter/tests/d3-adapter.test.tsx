import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExecutionContext, UISchema } from '@platform/schema';
import { createFallbackI18nProvider } from '@platform/i18n';
import { RenderPage } from '@platform/react-renderer';
import { registerD3Adapter } from '../src/index';

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

describe('react-d3-adapter', () => {
  it('renders inline svg chart', () => {
    registerD3Adapter();
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'chart',
      layout: { id: 'root', type: 'section', componentIds: ['chart'] },
      components: [
        {
          id: 'chart',
          type: 'chart',
          adapterHint: 'd3.chart',
          props: { series: [10, 20, 30] },
          accessibility: { ariaLabelKey: 'runtime.revenue.chart.aria', keyboardNav: true, focusOrder: 1 },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <RenderPage uiSchema={schema} data={{}} context={context} i18n={createFallbackI18nProvider()} />,
    );

    expect(html).toContain('<svg');
  });
});
