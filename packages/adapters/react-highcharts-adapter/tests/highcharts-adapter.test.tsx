import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExecutionContext, JSONValue, UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { createFallbackI18nProvider } from '@platform/i18n';
import { eventBus } from '@platform/runtime';
import { registerHighchartsAdapter, renderChart } from '../src/index';

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

describe('react-highcharts-adapter', () => {
  it('renders inline bar chart', () => {
    registerHighchartsAdapter();
    const component: UIComponent = {
      id: 'chart',
      type: 'chart',
      adapterHint: 'highcharts.chart',
      props: { series: [12, 8, 20] },
      accessibility: { ariaLabelKey: 'runtime.revenue.chart.aria', keyboardNav: true, focusOrder: 1 },
    };
    const html = renderToStaticMarkup(renderChart(component, createAdapterContext({})));

    expect(html).toContain('<svg');
  });

  it('publishes onDataPointClick when a bar is clicked', () => {
    const handler = vi.fn();
    eventBus.subscribe('onDataPointClick', handler);

    const component: UIComponent = {
      id: 'chart',
      type: 'chart',
      adapterHint: 'highcharts.chart',
      props: { series: [12, 8, 20] },
      accessibility: { ariaLabelKey: 'runtime.revenue.chart.aria', keyboardNav: true, focusOrder: 1 },
    };

    const ctx = createAdapterContext({});

    const element = renderChart(component, ctx);
    const rootChildren = React.Children.toArray(element.props.children);
    const svg = rootChildren[2] as React.ReactElement;
    const bars = React.Children.toArray(svg.props.children);
    const firstBar = bars[0] as React.ReactElement;

    firstBar.props.onClick?.();

    expect(handler).toHaveBeenCalledWith({ componentId: 'chart', index: 0, value: 12 });
    eventBus.unsubscribe('onDataPointClick', handler);
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
