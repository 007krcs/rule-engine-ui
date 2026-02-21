import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, JSONValue, UISchema } from '@platform/schema';
import { createProviderFromBundles } from '@platform/i18n';
import {
  RenderPageAngular,
  createAdapterRegistry,
  hydrateAngular,
  isAdapterRegistered,
  listRegisteredAdapterPrefixes,
  renderAngular,
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

describe('angular-renderer', () => {
  it('renders platform subset and layout', () => {
    const html = renderAngular({ uiSchema: schema, data: buildData(), context });
    expect(html).toContain('data-ui-page="portable-page"');
    expect(html).toContain('data-rf-component-id="nameField"');
    expect(html).toContain('<select');
    expect(html).toContain('<button');
    expect(html).toContain('<table');
  });

  it('evaluates component visibility rules', () => {
    const hiddenHtml = renderAngular({ uiSchema: schema, data: buildData(false), context });
    expect(hiddenHtml).not.toContain('data-rf-component-id="nameField"');
    expect(hiddenHtml).toContain('data-rf-component-id="saveButton"');
  });

  it('resolves bindings and emits events through dispatch API', () => {
    const onEvent = vi.fn();
    const onChange = vi.fn();
    const onAdapterEvent = vi.fn();
    const result = RenderPageAngular({
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

    const result = RenderPageAngular({
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

    expect(() => renderAngular({ uiSchema: badSchema, data: {}, context })).toThrow(
      'ariaLabelKey is required',
    );
  });

  it('hydrates rendered html and auto-binds dom listeners', () => {
    class FakeElement {
      constructor(private readonly attrs: Record<string, string>) {}
      getAttribute(name: string) {
        return this.attrs[name] ?? null;
      }
      closest() {
        return this;
      }
    }
    class FakeTarget {
      innerHTML = '';
      private listeners = new Map<string, (event: Event) => void>();
      addEventListener(type: string, handler: (event: Event) => void) {
        this.listeners.set(type, handler);
      }
      removeEventListener(type: string) {
        this.listeners.delete(type);
      }
      emit(type: string, event: Event) {
        this.listeners.get(type)?.(event);
      }
    }

    const prevElement = (globalThis as any).Element;
    (globalThis as any).Element = FakeElement;
    const target = new FakeTarget() as unknown as HTMLElement;
    const onEvent = vi.fn();
    const result = RenderPageAngular({
      uiSchema: schema,
      data: buildData(),
      context,
      onEvent,
    });
    const session = hydrateAngular({ result, target });
    expect((target as any).innerHTML).toContain('portable-page');

    const eventTarget = new FakeElement({
      'data-rf-event': 'onClick',
      'data-rf-component-id': 'saveButton',
    });
    (target as any).emit('click', {
      target: eventTarget,
      preventDefault: () => undefined,
    } as unknown as Event);
    expect(onEvent).toHaveBeenCalled();
    session.dispose();
    (globalThis as any).Element = prevElement;
  });

  it('renders flex and nested grid layouts with responsive hints', () => {
    const layoutSchema: UISchema = {
      version: '1.0.0',
      pageId: 'layout-page',
      layout: {
        id: 'root',
        type: 'stack',
        props: { layoutMode: 'row', wrap: true, gap: 12 },
        children: [
          {
            id: 'nested',
            type: 'grid',
            props: { layoutMode: 'nested-grid', minColumnWidth: 220, responsiveRows: 2, gap: 8 },
            componentIds: ['saveButton'],
          },
        ],
      },
      components: schema.components.filter((component) => component.id === 'saveButton'),
    };
    const html = renderAngular({ uiSchema: layoutSchema, data: buildData(), context });
    expect(html).toContain('display:flex');
    expect(html).toContain('grid-template-columns:repeat(auto-fit,minmax(220px,1fr))');
    expect(html).toContain('grid-template-rows:repeat(2,minmax(0,auto))');
  });

  it('renders RTL direction and flips row layout for RTL locales', () => {
    const rtlI18n = createProviderFromBundles({
      locale: 'ar',
      bundles: [
        {
          locale: 'ar',
          namespace: 'runtime',
          messages: {
            'runtime.customer.save.aria': 'حفظ',
          },
        },
      ],
      localeThemes: {
        base: { 'font.size.base': 14 },
        byLocale: { ar: { 'font.size.base': 16 } },
      },
    });
    const layoutSchema: UISchema = {
      version: '1.0.0',
      pageId: 'rtl-page',
      layout: {
        id: 'root',
        type: 'stack',
        props: { layoutMode: 'row', gap: 8 },
        componentIds: ['saveButton'],
      },
      components: schema.components.filter((component) => component.id === 'saveButton'),
    };
    const html = renderAngular({ uiSchema: layoutSchema, data: buildData(), context: { ...context, locale: 'ar' }, i18n: rtlI18n });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('flex-direction:row-reverse');
    expect(html).toContain('direction:rtl');
    expect(html).toContain('--rf-locale-font-size-base:16');
  });

  it('reports render metrics callback', () => {
    const onRenderMetrics = vi.fn();
    renderAngular({
      uiSchema: schema,
      data: buildData(),
      context,
      onRenderMetrics,
    });
    expect(onRenderMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: expect.any(Number),
        componentCount: schema.components.length,
      }),
    );
  });
});
