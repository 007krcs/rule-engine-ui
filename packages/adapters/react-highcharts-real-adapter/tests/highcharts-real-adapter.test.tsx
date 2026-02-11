import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExecutionContext, UISchema } from '@platform/schema';
import { createFallbackI18nProvider } from '@platform/i18n';
import { RenderPage } from '@platform/react-renderer';
import { registerHighchartsAdapter } from '../src/index';

vi.mock('highcharts-react-official', () => ({
  default: () => <div data-testid="highcharts-real" />,
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

describe('react-highcharts-real-adapter', () => {
  it('renders Highcharts adapter when enabled', () => {
    process.env.RULEFLOW_REAL_ADAPTERS = '1';
    registerHighchartsAdapter();
    const schema: UISchema = {
      version: '1.0.0',
      pageId: 'page',
      layout: { id: 'root', type: 'section', componentIds: ['chart'] },
      components: [
        {
          id: 'chart',
          type: 'chart',
          adapterHint: 'highcharts.chart',
          props: { series: [1, 2, 3] },
          accessibility: { ariaLabelKey: 'runtime.revenue.chart.aria', keyboardNav: true, focusOrder: 1 },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <RenderPage uiSchema={schema} data={{}} context={context} i18n={createFallbackI18nProvider()} />,
    );
    expect(html).toContain('highcharts-real');
  });
});
