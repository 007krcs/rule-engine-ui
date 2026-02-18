import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, JSONValue, UISchema } from '@platform/schema';
import {
  RenderPageVue,
  createAdapterRegistry,
  isAdapterRegistered,
  listRegisteredAdapterPrefixes,
  renderVue,
} from '../src/index';

const context: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'Author',
  roles: ['Author'],
  country: 'US',
  locale: 'en-US',
  timezone: 'UTC',
  device: 'desktop',
  permissions: ['read'],
  featureFlags: {},
};

const schema: UISchema = {
  version: '1.0.0',
  pageId: 'portable-page',
  layout: {
    id: 'root',
    type: 'section',
    componentIds: ['nameField', 'roleSelect', 'saveButton', 'summaryTable'],
  },
  components: [
    {
      id: 'nameField',
      type: 'input',
      adapterHint: 'platform.textField',
      props: { label: 'Customer Name' },
      bindings: { data: { value: 'data.customer.name' } },
      rules: {
        visibleWhen: {
          op: 'eq',
          left: { path: 'data.flags.showName' },
          right: { value: true },
        },
      },
      accessibility: {
        ariaLabelKey: 'runtime.customer.name.aria',
        keyboardNav: true,
        focusOrder: 1,
      },
    },
    {
      id: 'roleSelect',
      type: 'select',
      adapterHint: 'platform.select',
      props: {
        options: [
          { value: 'author', label: 'Author' },
          { value: 'approver', label: 'Approver' },
        ],
      },
      bindings: { data: { value: 'data.customer.role' } },
      accessibility: {
        ariaLabelKey: 'runtime.customer.role.aria',
        keyboardNav: true,
        focusOrder: 2,
      },
    },
    {
      id: 'saveButton',
      type: 'action',
      adapterHint: 'platform.button',
      props: { label: 'Save' },
      events: {
        onClick: [{ type: 'emitEvent', payload: { event: 'save' } }],
      },
      accessibility: {
        ariaLabelKey: 'runtime.customer.save.aria',
        keyboardNav: true,
        focusOrder: 3,
      },
    },
    {
      id: 'summaryTable',
      type: 'table',
      adapterHint: 'platform.table',
      props: {
        columns: [
          { field: 'invoice' },
          { field: 'status' },
        ],
        rows: [
          { invoice: 'INV-101', status: 'Open' },
          { invoice: 'INV-102', status: 'Paid' },
        ],
      },
      accessibility: {
        ariaLabelKey: 'runtime.customer.table.aria',
        keyboardNav: true,
        focusOrder: 4,
      },
    },
  ],
};

function buildData(showName = true): Record<string, JSONValue> {
  return {
    customer: {
      name: '',
      role: 'author',
    },
    flags: {
      showName,
    },
  };
}

describe('vue-renderer', () => {
  it('renders platform subset and layout', () => {
    const html = renderVue({ uiSchema: schema, data: buildData(), context });
    expect(html).toContain('data-ui-page="portable-page"');
    expect(html).toContain('data-rf-component-id="nameField"');
    expect(html).toContain('<select');
    expect(html).toContain('<button');
    expect(html).toContain('<table');
  });

  it('evaluates component visibility rules', () => {
    const hiddenHtml = renderVue({ uiSchema: schema, data: buildData(false), context });
    expect(hiddenHtml).not.toContain('data-rf-component-id="nameField"');
    expect(hiddenHtml).toContain('data-rf-component-id="saveButton"');
  });

  it('resolves bindings and emits events through dispatch API', () => {
    const onEvent = vi.fn();
    const onChange = vi.fn();
    const onAdapterEvent = vi.fn();
    const result = RenderPageVue({
      uiSchema: schema,
      data: buildData(),
      context,
      onEvent,
      onChange,
      onAdapterEvent,
    });

    result.dispatchEvent({
      event: 'onChange',
      componentId: 'nameField',
      bindingPath: 'data.customer.name',
      value: 'Alice',
    });
    result.dispatchEvent({
      event: 'onClick',
      componentId: 'saveButton',
    });

    expect(result.data.customer).toEqual({ name: 'Alice', role: 'author' });
    expect(result.html).toContain('value="Alice"');
    expect(onChange).toHaveBeenCalledWith('data.customer.name', 'Alice', 'nameField');
    expect(onAdapterEvent).toHaveBeenCalledWith(
      'onChange',
      expect.objectContaining({ componentId: 'nameField', value: 'Alice' }),
      expect.objectContaining({ id: 'nameField' }),
    );
    expect(onEvent).toHaveBeenCalledWith(
      'onClick',
      expect.arrayContaining([expect.objectContaining({ type: 'emitEvent' })]),
      expect.objectContaining({ id: 'saveButton' }),
    );
  });

  it('supports adapter registry registration and discovery', () => {
    const registry = createAdapterRegistry();
    registry.register('custom.', (component) => `<article>${component.id}</article>`);

    const customSchema: UISchema = {
      version: '1.0.0',
      pageId: 'custom-page',
      layout: { id: 'root', type: 'section', componentIds: ['customCard'] },
      components: [
        {
          id: 'customCard',
          type: 'display',
          adapterHint: 'custom.card',
          accessibility: {
            ariaLabelKey: 'runtime.custom.card.aria',
            keyboardNav: true,
            focusOrder: 1,
          },
        },
      ],
    };

    const result = RenderPageVue({
      uiSchema: customSchema,
      data: {},
      context,
      adapterRegistry: registry,
    });

    expect(result.html).toContain('<article>customCard</article>');
    expect(isAdapterRegistered('custom.card', registry)).toBe(true);
    expect(isAdapterRegistered('custom.', registry)).toBe(true);
    expect(listRegisteredAdapterPrefixes(registry)).toContain('custom.');
  });

  it('throws on accessibility violations', () => {
    const badSchema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['field'] },
      components: [
        {
          id: 'field',
          type: 'input',
          adapterHint: 'platform.textField',
          accessibility: { ariaLabelKey: '', keyboardNav: false, focusOrder: 0 },
        },
      ],
    };

    expect(() => renderVue({ uiSchema: badSchema, data: {}, context })).toThrow('ariaLabelKey is required');
  });
});
