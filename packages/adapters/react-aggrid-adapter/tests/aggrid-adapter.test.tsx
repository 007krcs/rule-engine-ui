import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExecutionContext, UISchema } from '@platform/schema';
import { createFallbackI18nProvider } from '@platform/i18n';
import { RenderPage } from '@platform/react-renderer';
import { registerAgGridAdapter } from '../src/index';

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

describe('react-aggrid-adapter', () => {
  it('renders rows and columns', () => {
    registerAgGridAdapter();
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'table',
      layout: { id: 'root', type: 'section', componentIds: ['table'] },
      components: [
        {
          id: 'table',
          type: 'table',
          adapterHint: 'aggrid.table',
          props: {
            columns: [
              { field: 'orderId', headerName: 'Order' },
              { field: 'total', headerName: 'Total' },
            ],
            rows: [
              { orderId: 'o-1', total: 100 },
              { orderId: 'o-2', total: 200 },
            ],
          },
          accessibility: { ariaLabelKey: 'runtime.orders.table.aria', keyboardNav: true, focusOrder: 1 },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <RenderPage uiSchema={schema} data={{}} context={context} i18n={createFallbackI18nProvider()} />,
    );

    expect(html).toContain('Order');
    expect(html).toContain('o-2');
  });
});
