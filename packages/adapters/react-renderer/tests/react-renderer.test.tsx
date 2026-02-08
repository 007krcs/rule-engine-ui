import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExecutionContext, UIComponent, UISchema } from '@platform/schema';
import { createFallbackI18nProvider } from '@platform/i18n';
import { registerAdapter, RenderPage } from '../src/index';

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
    let captured: { onClick?: () => void } | null = null;
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
});
