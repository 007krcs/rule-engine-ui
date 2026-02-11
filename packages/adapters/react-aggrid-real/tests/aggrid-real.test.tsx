import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RenderPage } from '@platform/react-renderer';
import type { ExecutionContext, UISchema } from '@platform/schema';
import { registerAgGridRealAdapter } from '../src/index';

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

describe('react-aggrid-real', () => {
  it('renders ag-grid adapter without crashing', () => {
    registerAgGridRealAdapter();
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['table'] },
      components: [
        {
          id: 'table',
          type: 'table',
          adapterHint: 'aggrid.table',
          props: {
            columnDefs: [{ field: 'orderId', headerName: 'Order' }],
            rowData: [{ orderId: 'A-1' }],
          },
          accessibility: { ariaLabelKey: 'runtime.orders.table.aria', keyboardNav: true, focusOrder: 1 },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <RenderPage uiSchema={schema} data={{}} context={context} />,
    );
    expect(html).toContain('ag-grid-real');
  });
});
