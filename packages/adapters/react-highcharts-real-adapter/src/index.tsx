import React from 'react';
import type { UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

let registered = false;

export function registerHighchartsRealAdapter(): void {
  if (registered) return;
  registered = true;
  registerAdapter('highcharts.', (component, ctx) => renderChart(component, ctx));
}

export function registerHighchartsAdapter(options?: { enabled?: boolean }): void {
  const enabled =
    options?.enabled ??
    (typeof process !== 'undefined' && process.env?.RULEFLOW_REAL_ADAPTERS === '1');
  if (!enabled) return;
  registerHighchartsRealAdapter();
}

function renderChart(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  const label = component.i18n?.labelKey
    ? ctx.i18n.t(component.i18n.labelKey)
    : String(component.props?.title ?? component.id);

  const options = resolveOptions(component, ctx, label);
  return (
    <div aria-label={ariaLabel} style={{ display: 'grid', gap: 8 }}>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}

function resolveOptions(component: UIComponent, ctx: AdapterContext, label: string): Highcharts.Options {
  const options = component.props?.options;
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    return options as Highcharts.Options;
  }
  const series = resolveSeries(component, ctx);
  return {
    title: { text: label },
    series: [
      {
        type: 'line',
        name: label,
        data: series,
      },
    ],
  };
}

function resolveSeries(component: UIComponent, ctx: AdapterContext): number[] {
  const bound = ctx.bindings.data.series?.value;
  if (Array.isArray(bound)) {
    return bound.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }
  const fromProps = component.props?.series;
  if (Array.isArray(fromProps)) {
    return fromProps.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }
  return [];
}
