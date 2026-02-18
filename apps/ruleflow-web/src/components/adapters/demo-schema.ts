import type { ExecutionContext, JSONValue, UISchema } from '@platform/schema';

export const adapterDemoSchema: UISchema = {
  version: '1.0.0',
  pageId: 'adapters-portability-demo',
  layout: {
    id: 'root',
    type: 'section',
    componentIds: ['infoSection', 'customerName', 'customerStatus', 'saveButton', 'ordersTable'],
  },
  components: [
    {
      id: 'infoSection',
      type: 'layout',
      adapterHint: 'platform.section',
      props: { label: 'Adapter Portability Demo' },
      accessibility: {
        ariaLabelKey: 'runtime.adapters.infoSection.aria',
        keyboardNav: true,
        focusOrder: 1,
      },
    },
    {
      id: 'customerName',
      type: 'input',
      adapterHint: 'platform.textField',
      props: { label: 'Customer Name' },
      bindings: {
        data: {
          value: 'data.customer.name',
        },
      },
      rules: {
        visibleWhen: {
          op: 'eq',
          left: { path: 'data.ui.showName' },
          right: { value: true },
        },
      },
      accessibility: {
        ariaLabelKey: 'runtime.adapters.customerName.aria',
        keyboardNav: true,
        focusOrder: 2,
      },
    },
    {
      id: 'customerStatus',
      type: 'select',
      adapterHint: 'platform.select',
      props: {
        options: [
          { value: 'active', label: 'Active' },
          { value: 'review', label: 'In Review' },
          { value: 'hold', label: 'On Hold' },
        ],
      },
      bindings: {
        data: {
          value: 'data.customer.status',
        },
      },
      accessibility: {
        ariaLabelKey: 'runtime.adapters.customerStatus.aria',
        keyboardNav: true,
        focusOrder: 3,
      },
    },
    {
      id: 'saveButton',
      type: 'action',
      adapterHint: 'platform.button',
      props: { label: 'Save Changes' },
      events: {
        onClick: [{ type: 'emitEvent', payload: { action: 'save' } }],
      },
      accessibility: {
        ariaLabelKey: 'runtime.adapters.saveButton.aria',
        keyboardNav: true,
        focusOrder: 4,
      },
    },
    {
      id: 'ordersTable',
      type: 'data',
      adapterHint: 'platform.table',
      props: {
        columns: [{ field: 'invoice' }, { field: 'customer' }, { field: 'status' }],
        rows: [
          { invoice: 'INV-1001', customer: 'Ada Lovelace', status: 'Paid' },
          { invoice: 'INV-1002', customer: 'Alan Turing', status: 'Open' },
        ],
      },
      accessibility: {
        ariaLabelKey: 'runtime.adapters.ordersTable.aria',
        keyboardNav: true,
        focusOrder: 5,
      },
    },
  ],
};

export const adapterDemoData: Record<string, JSONValue> = {
  customer: {
    name: 'Grace Hopper',
    status: 'active',
  },
  ui: {
    showName: true,
  },
};

export const adapterDemoContext: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'adapter-demo',
  role: 'Author',
  roles: ['Author'],
  country: 'US',
  locale: 'en-US',
  timezone: 'UTC',
  device: 'desktop',
  permissions: ['read'],
  featureFlags: {},
};

export function cloneDemoData(): Record<string, JSONValue> {
  return JSON.parse(JSON.stringify(adapterDemoData)) as Record<string, JSONValue>;
}
