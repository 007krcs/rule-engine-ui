import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AdapterContext } from '@platform/react-renderer';
import type { ExecutionContext, JSONValue, UIComponent } from '@platform/schema';
import { createFallbackI18nProvider } from '@platform/i18n';
import { eventBus } from '@platform/runtime';
import { __resetAgGridFilterState, registerAgGridAdapter, renderTable } from '../src/index';

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
    __resetAgGridFilterState();
    registerAgGridAdapter();
    const component: UIComponent = {
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
    };
    const html = renderToStaticMarkup(renderTable(component, createAdapterContext({})));

    expect(html).toContain('Order');
    expect(html).toContain('o-2');
  });

  it('subscribes to filterChanged and filters rows', () => {
    __resetAgGridFilterState();
    registerAgGridAdapter();
    const component: UIComponent = {
      id: 'table',
      type: 'table',
      adapterHint: 'aggrid.table',
      props: {
        columns: [
          { field: 'customer', headerName: 'Customer' },
          { field: 'total', headerName: 'Total' },
        ],
        rows: [
          { customer: 'ACME Corp', total: 100 },
          { customer: 'Northwind', total: 200 },
        ],
      },
      accessibility: { ariaLabelKey: 'runtime.orders.table.aria', keyboardNav: true, focusOrder: 1 },
    };

    eventBus.publish('filterChanged', { componentId: 'customerName', value: 'acme' });

    const html = renderToStaticMarkup(renderTable(component, createAdapterContext({})));

    expect(html).toContain('ACME Corp');
    expect(html).not.toContain('Northwind');
  });
});

function createAdapterContext(data: Record<string, JSONValue>): AdapterContext {
  return {
    data,
    context,
    i18n: createFallbackI18nProvider(),
    bindings: { data: {}, context: {}, computed: {} },
    events: { onChange: () => undefined, onClick: () => undefined, onSubmit: () => undefined },
  };
}
