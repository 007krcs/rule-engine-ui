import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExecutionContext, UISchema } from '@platform/schema';
import { createFallbackI18nProvider } from '@platform/i18n';
import { RenderPage } from '@platform/react-renderer';
import { registerAgGridAdapter } from '../src/index';

vi.mock('ag-grid-react', () => ({
  AgGridReact: () => <div data-testid="ag-grid-real" />,
}));

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

describe('react-aggrid-real-adapter', () => {
  it('renders AG Grid adapter when enabled', () => {
    process.env.RULEFLOW_REAL_ADAPTERS = '1';
    registerAgGridAdapter();
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['table'] },
      components: [
        {
          id: 'table',
          type: 'table',
          adapterHint: 'aggrid.table',
          props: { columns: [{ field: 'orderId', headerName: 'Order' }] },
          accessibility: { ariaLabelKey: 'runtime.orders.table.aria', keyboardNav: true, focusOrder: 1 },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <RenderPage uiSchema={schema} data={{ orders: [] }} context={context} i18n={createFallbackI18nProvider()} />,
    );
    expect(html).toContain('ag-grid-real');
  });
});
