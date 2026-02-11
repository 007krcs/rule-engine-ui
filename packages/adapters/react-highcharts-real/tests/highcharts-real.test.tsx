import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RenderPage } from '@platform/react-renderer';
import type { ExecutionContext, UISchema } from '@platform/schema';
import { registerHighchartsRealAdapter } from '../src/index';

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

describe('react-highcharts-real', () => {
  it('renders highcharts adapter without crashing', () => {
    registerHighchartsRealAdapter();
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['chart'] },
      components: [
        {
          id: 'chart',
          type: 'chart',
          adapterHint: 'highcharts.chart',
          props: {
            config: {
              title: { text: 'Revenue' },
              series: [{ type: 'line', data: [1, 2, 3] }],
            },
          },
          accessibility: { ariaLabelKey: 'runtime.revenue.chart.aria', keyboardNav: true, focusOrder: 1 },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <RenderPage uiSchema={schema} data={{}} context={context} />,
    );
    expect(html).toContain('data-component-id="chart"');
  });
});
