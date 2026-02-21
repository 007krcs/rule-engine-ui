import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext, JSONValue, UISchema } from '@platform/schema';
import {
  RenderPageAngular,
  createAdapterRegistry,
  createEventDispatcher,
  isAdapterRegistered,
  listRegisteredAdapterPrefixes,
  renderAngular,
  renderColumnLayout,
  renderFlexboxLayout,
  renderNestedGridLayout,
  renderRowLayout,
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
});

describe('event-dispatcher', () => {
  it('creates an event dispatcher that manages data state', () => {
    const componentMap = new Map(schema.components.map((c) => [c.id, c]));
    const onDataChange = vi.fn();
    const onChange = vi.fn();

    const dispatcher = createEventDispatcher(
      componentMap,
      buildData(),
      context,
      { onDataChange, onChange },
    );

    dispatcher.dispatch({
      event: 'onChange',
      componentId: 'nameField',
      bindingPath: 'data.customer.name',
      value: 'Test User',
    });

    expect(dispatcher.getData().customer).toEqual({ name: 'Test User', role: 'author' });
    expect(onDataChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('data.customer.name', 'Test User', 'nameField');
  });

  it('dispatches click events', () => {
    const componentMap = new Map(schema.components.map((c) => [c.id, c]));
    const onEvent = vi.fn();
    const onAdapterEvent = vi.fn();

    const dispatcher = createEventDispatcher(
      componentMap,
      buildData(),
      context,
      { onEvent, onAdapterEvent },
    );

    dispatcher.dispatch({
      event: 'onClick',
      componentId: 'saveButton',
    });

    expect(onAdapterEvent).toHaveBeenCalledWith(
      'onClick',
      { componentId: 'saveButton' },
      expect.objectContaining({ id: 'saveButton' }),
    );
    expect(onEvent).toHaveBeenCalledWith(
      'onClick',
      expect.arrayContaining([expect.objectContaining({ type: 'emitEvent' })]),
      expect.objectContaining({ id: 'saveButton' }),
    );
  });

  it('handles missing components gracefully', () => {
    const componentMap = new Map(schema.components.map((c) => [c.id, c]));
    const onChange = vi.fn();

    const dispatcher = createEventDispatcher(
      componentMap,
      buildData(),
      context,
      { onChange },
    );

    dispatcher.dispatch({
      event: 'onChange',
      componentId: 'nonexistent',
      value: 'test',
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('layout-rendering', () => {
  it('renders stack layout with flexbox properties', () => {
    const stackSchema: UISchema = {
      version: '1.0.0',
      pageId: 'stack-page',
      layout: {
        id: 'root',
        type: 'stack',
        direction: 'horizontal',
        componentIds: ['nameField'],
        props: { gap: 24, justify: 'space-between', align: 'center', wrap: true },
      },
      components: [
        {
          id: 'nameField',
          type: 'input',
          adapterHint: 'platform.textField',
          props: { label: 'Name' },
          accessibility: {
            ariaLabelKey: 'name.aria',
            keyboardNav: true,
            focusOrder: 1,
          },
        },
      ],
    };

    const html = renderAngular({ uiSchema: stackSchema, data: {}, context });
    expect(html).toContain('data-layout="stack"');
    expect(html).toContain('data-direction="horizontal"');
    expect(html).toContain('flex-direction:row');
    expect(html).toContain('gap:24px');
    expect(html).toContain('justify-content:space-between');
    expect(html).toContain('align-items:center');
    expect(html).toContain('flex-wrap:wrap');
  });

  it('renders grid layout with columns', () => {
    const gridSchema: UISchema = {
      version: '1.0.0',
      pageId: 'grid-page',
      layout: {
        id: 'root',
        type: 'grid',
        columns: 6,
        componentIds: ['nameField'],
        props: { gap: 16 },
      },
      components: [
        {
          id: 'nameField',
          type: 'input',
          adapterHint: 'platform.textField',
          props: { label: 'Name' },
          accessibility: {
            ariaLabelKey: 'name.aria',
            keyboardNav: true,
            focusOrder: 1,
          },
        },
      ],
    };

    const html = renderAngular({ uiSchema: gridSchema, data: {}, context });
    expect(html).toContain('data-layout="grid"');
    expect(html).toContain('display:grid');
    expect(html).toContain('grid-template-columns:repeat(6,minmax(0,1fr))');
    expect(html).toContain('gap:16px');
  });

  it('renders section with flexbox when enabled', () => {
    const sectionSchema: UISchema = {
      version: '1.0.0',
      pageId: 'section-page',
      layout: {
        id: 'root',
        type: 'section',
        title: 'Test Section',
        componentIds: ['nameField'],
        props: { flexbox: true, direction: 'horizontal', gap: 20 },
      },
      components: [
        {
          id: 'nameField',
          type: 'input',
          adapterHint: 'platform.textField',
          props: { label: 'Name' },
          accessibility: {
            ariaLabelKey: 'name.aria',
            keyboardNav: true,
            focusOrder: 1,
          },
        },
      ],
    };

    const html = renderAngular({ uiSchema: sectionSchema, data: {}, context });
    expect(html).toContain('data-layout="section"');
    expect(html).toContain('data-flexbox="true"');
    expect(html).toContain('display:flex');
    expect(html).toContain('flex-direction:row');
    expect(html).toContain('gap:20px');
  });

  it('renders responsive grid with breakpoints', () => {
    const mobileContext: ExecutionContext = { ...context, device: 'mobile' };
    const gridSchema: UISchema = {
      version: '1.0.0',
      pageId: 'responsive-grid-page',
      layoutType: 'grid',
      grid: {
        columns: 12,
        rowHeight: 56,
        gap: 12,
        breakpoints: {
          sm: { columns: 4, rowHeight: 48, gap: 8 },
          md: { columns: 8, rowHeight: 52, gap: 10 },
        },
      },
      layout: { id: 'root', type: 'section' },
      items: [
        { id: 'item1', componentId: 'nameField', x: 0, y: 0, w: 6, h: 1 },
      ],
      components: [
        {
          id: 'nameField',
          type: 'input',
          adapterHint: 'platform.textField',
          props: { label: 'Name' },
          accessibility: {
            ariaLabelKey: 'name.aria',
            keyboardNav: true,
            focusOrder: 1,
          },
        },
      ],
    };

    const desktopHtml = renderAngular({ uiSchema: gridSchema, data: {}, context });
    expect(desktopHtml).toContain('grid-template-columns:repeat(12,minmax(0,1fr))');
    expect(desktopHtml).toContain('gap:12px');

    const mobileHtml = renderAngular({ uiSchema: gridSchema, data: {}, context: mobileContext });
    expect(mobileHtml).toContain('grid-template-columns:repeat(4,minmax(0,1fr))');
    expect(mobileHtml).toContain('gap:8px');
  });

  it('renders tabs with tab IDs', () => {
    const tabsSchema: UISchema = {
      version: '1.0.0',
      pageId: 'tabs-page',
      layout: {
        id: 'root',
        type: 'tabs',
        tabs: [
          { id: 'tab1', label: 'Tab One', child: { id: 'tab1-content', type: 'section', componentIds: [] } },
          { id: 'tab2', label: 'Tab Two', child: { id: 'tab2-content', type: 'section', componentIds: [] } },
        ],
      },
      components: [],
    };

    const html = renderAngular({ uiSchema: tabsSchema, data: {}, context });
    expect(html).toContain('data-layout="tabs"');
    expect(html).toContain('data-tab-id="tab1"');
    expect(html).toContain('data-tab-id="tab2"');
    expect(html).toContain('<h3>Tab One</h3>');
    expect(html).toContain('<h3>Tab Two</h3>');
  });
});

describe('layout-helpers', () => {
  it('renders row layout', () => {
    const html = renderRowLayout(['comp1', 'comp2'], 4, 16);
    expect(html).toContain('data-layout="row"');
    expect(html).toContain('grid-template-columns:repeat(4,minmax(0,1fr))');
    expect(html).toContain('gap:16px');
    expect(html).toContain('data-slot="comp1"');
    expect(html).toContain('data-slot="comp2"');
  });

  it('renders column layout', () => {
    const html = renderColumnLayout(6);
    expect(html).toContain('data-layout="column"');
    expect(html).toContain('grid-column:span 6');
  });

  it('renders flexbox layout with custom options', () => {
    const html = renderFlexboxLayout('column', {
      gap: 24,
      justify: 'center',
      align: 'flex-end',
      wrap: true,
    });
    expect(html).toContain('data-layout="flexbox"');
    expect(html).toContain('flex-direction:column');
    expect(html).toContain('gap:24px');
    expect(html).toContain('justify-content:center');
    expect(html).toContain('align-items:flex-end');
    expect(html).toContain('flex-wrap:wrap');
  });

  it('renders nested grid layout', () => {
    const html = renderNestedGridLayout(3, 8);
    expect(html).toContain('data-layout="nested-grid"');
    expect(html).toContain('grid-template-columns:repeat(3,minmax(0,1fr))');
    expect(html).toContain('gap:8px');
  });
});
