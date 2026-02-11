import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { executeStep } from '../../../core-runtime/src/index';
import type { ExecutionContext, FlowSchema, JSONValue, Rule, UIComponent, UISchema } from '@platform/schema';
import { createFallbackI18nProvider } from '@platform/i18n';
import { registerAdapter, RenderPage, type AdapterContext } from '../src/index';

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

describe('react-renderer', () => {
  it('renders a component tree and matches snapshot', () => {
    registerAdapter('test.', (component, ctx) => (
      <div aria-label={ctx.i18n.t(component.accessibility.ariaLabelKey)}>{component.id}</div>
    ));

    const component: UIComponent = {
      id: 'comp-1',
      type: 'card',
      adapterHint: 'test.card',
      accessibility: {
        ariaLabelKey: 'runtime.customViz.aria',
        keyboardNav: true,
        focusOrder: 1,
      },
    };

    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['comp-1'] },
      components: [component],
    };

    const html = renderToStaticMarkup(
      <RenderPage uiSchema={schema} data={{}} context={context} i18n={createFallbackI18nProvider()} />,
    );
    expect(html).toMatchInlineSnapshot(
      '"<div data-ui-page="page" dir="ltr"><section data-layout="section"><div data-component-id="comp-1"><div aria-label="runtime.customViz.aria">comp-1</div></div></section></div>"',
    );
  });

  it('fails fast on accessibility violations', () => {
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'invalid',
      layout: { id: 'root', type: 'section', componentIds: ['bad'] },
      components: [
        {
          id: 'bad',
          type: 'card',
          adapterHint: 'test.card',
          accessibility: {
            ariaLabelKey: '',
            keyboardNav: false,
            focusOrder: 0,
          },
        },
      ],
    };

    expect(() =>
      renderToStaticMarkup(
        <RenderPage uiSchema={schema} data={{}} context={context} i18n={createFallbackI18nProvider()} />,
      ),
    ).toThrow('ariaLabelKey is required');
  });

  it('wires event handlers for adapters', () => {
    let captured: AdapterContext['events'] | null = null;
    registerAdapter('event.', (_component, ctx) => {
      captured = ctx.events;
      return <button onClick={ctx.events.onClick}>Run</button>;
    });

    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['btn'] },
      components: [
        {
          id: 'btn',
          type: 'button',
          adapterHint: 'event.button',
          events: { onClick: [{ type: 'emitEvent', payload: { ok: true } }] },
          accessibility: {
            ariaLabelKey: 'runtime.orders.table.aria',
            keyboardNav: true,
            focusOrder: 1,
          },
        },
      ],
    };

    renderToStaticMarkup(
      <RenderPage
        uiSchema={schema}
        data={{}}
        context={context}
        i18n={createFallbackI18nProvider()}
        onEvent={() => undefined}
      />,
    );

    expect(typeof captured?.onClick).toBe('function');
  });

  it('resolves data, context, and computed bindings for adapters', () => {
    let captured: AdapterContext | null = null;
    registerAdapter('bind.', (_component, ctx) => {
      captured = ctx;
      return <div>bindings</div>;
    });

    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['input'] },
      components: [
        {
          id: 'input',
          type: 'input',
          adapterHint: 'bind.input',
          bindings: {
            data: { value: 'data.orderTotal' },
            context: { role: 'context.role' },
            computed: { roleCopy: 'context.role' },
          },
          accessibility: {
            ariaLabelKey: 'runtime.orders.table.aria',
            keyboardNav: true,
            focusOrder: 1,
          },
        },
      ],
    };

    renderToStaticMarkup(
      <RenderPage
        uiSchema={schema}
        data={{ orderTotal: 1200 }}
        context={context}
        i18n={createFallbackI18nProvider()}
      />,
    );

    expect(captured?.bindings.data.value?.value).toBe(1200);
    expect(captured?.bindings.context.role?.value).toBe('admin');
    expect(captured?.bindings.computed.roleCopy?.value).toBe('admin');
  });

  it('dispatches binding changes from adapters', () => {
    let captured: AdapterContext | null = null;
    registerAdapter('change.', (_component, ctx) => {
      captured = ctx;
      return <div>change</div>;
    });

    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['input'] },
      components: [
        {
          id: 'input',
          type: 'input',
          adapterHint: 'change.input',
          bindings: { data: { value: 'data.orderTotal' } },
          accessibility: {
            ariaLabelKey: 'runtime.orders.table.aria',
            keyboardNav: true,
            focusOrder: 1,
          },
        },
      ],
    };

    let nextData: Record<string, unknown> | null = null;
    let nextContext: ExecutionContext | null = null;
    renderToStaticMarkup(
      <RenderPage
        uiSchema={schema}
        data={{ orderTotal: 1200 }}
        context={context}
        i18n={createFallbackI18nProvider()}
        onDataChange={(data) => {
          nextData = data;
        }}
        onContextChange={(ctx) => {
          nextContext = ctx;
        }}
      />,
    );

    captured?.events.onChange?.({ componentId: 'input', value: 500, bindingPath: 'data.orderTotal' });
    expect(nextData?.orderTotal).toBe(500);

    captured?.events.onChange?.({ componentId: 'input', value: 'user', bindingPath: 'context.role' });
    expect(nextContext?.role).toBe('user');
  });

  it('changes runtime rule outcomes after input binding updates', async () => {
    let captured: AdapterContext | null = null;
    registerAdapter('runtime.', (_component, ctx) => {
      captured = ctx;
      return <div>runtime</div>;
    });

    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['orderTotal'] },
      components: [
        {
          id: 'orderTotal',
          type: 'input',
          adapterHint: 'runtime.input',
          bindings: { data: { value: 'data.orderTotal' } },
          accessibility: {
            ariaLabelKey: 'runtime.filters.customerName.aria',
            keyboardNav: true,
            focusOrder: 1,
          },
        },
      ],
    };

    let latestData: Record<string, JSONValue> = { orderTotal: 1200 };
    renderToStaticMarkup(
      <RenderPage
        uiSchema={schema}
        data={latestData}
        context={context}
        i18n={createFallbackI18nProvider()}
        onDataChange={(next) => {
          latestData = next;
        }}
      />,
    );

    const flow: FlowSchema = {
      version: '1.0.0',
      flowId: 'binding-demo',
      initialState: 'start',
      states: {
        start: {
          uiPageId: 'page-start',
          on: {
            submit: {
              target: 'done',
              actions: ['evaluateRules'],
            },
          },
        },
        done: {
          uiPageId: 'page-done',
          on: {},
        },
      },
    };

    const uiSchemasById: Record<string, UISchema> = {
      'page-start': {
        version: '1.0.0',
        pageId: 'page-start',
        layout: { id: 'root', type: 'section', componentIds: [] },
        components: [],
      },
      'page-done': {
        version: '1.0.0',
        pageId: 'page-done',
        layout: { id: 'root', type: 'section', componentIds: [] },
        components: [],
      },
    };

    const rules: Rule[] = [
      {
        ruleId: 'HIGH_TOTAL_DISCOUNT',
        priority: 100,
        when: { op: 'gt', left: { path: 'data.orderTotal' }, right: { value: 1000 } },
        actions: [{ type: 'setField', path: 'data.discount', value: 15 }],
      },
    ];

    const highResult = await executeStep({
      flow,
      uiSchemasById,
      rules,
      apiMappingsById: {},
      stateId: 'start',
      event: 'submit',
      context,
      data: latestData,
    });
    expect(highResult.trace.rules?.rulesMatched).toContain('HIGH_TOTAL_DISCOUNT');
    expect(highResult.updatedData.discount).toBe(15);

    captured?.events.onChange?.(500, 'data.orderTotal');
    expect(latestData.orderTotal).toBe(500);

    const lowResult = await executeStep({
      flow,
      uiSchemasById,
      rules,
      apiMappingsById: {},
      stateId: 'start',
      event: 'submit',
      context,
      data: latestData,
    });
    expect(lowResult.trace.rules?.rulesMatched).not.toContain('HIGH_TOTAL_DISCOUNT');
    expect(lowResult.updatedData.discount).toBeUndefined();
  });
});
