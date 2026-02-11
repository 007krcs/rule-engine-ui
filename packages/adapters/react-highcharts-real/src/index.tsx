import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { registerAdapter, type AdapterContext } from '@platform/react-renderer';
import type { JSONValue, UIComponent } from '@platform/schema';

let registered = false;

export function registerHighchartsRealAdapter(): void {
  if (registered) return;
  registered = true;
  registerAdapter('highcharts.', (component, ctx) => renderChart(component, ctx));
}

export function registerHighchartsAdapter(options?: { enabled?: boolean }): void {
  const enabled = options?.enabled ?? (typeof process !== 'undefined' && process.env?.RULEFLOW_REAL_ADAPTERS === '1');
  if (!enabled) return;
  registerHighchartsRealAdapter();
}

function renderChart(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  const props = (component.props ?? {}) as Record<string, JSONValue>;
  const config = resolveChartConfig(props.config, props.options, ctx);

  return (
    <div aria-label={ariaLabel}>
      <HighchartsReact highcharts={Highcharts} options={config} />
    </div>
  );
}

function resolveChartConfig(
  config: JSONValue | undefined,
  options: JSONValue | undefined,
  ctx: AdapterContext,
): Highcharts.Options {
  if (isPlainRecord(config)) {
    return config as unknown as Highcharts.Options;
  }

  if (isPlainRecord(options)) {
    return options as unknown as Highcharts.Options;
  }

  const series = resolveSeries(ctx.bindings.data.series?.value);
  return {
    title: { text: 'Chart' },
    series: [
      {
        type: 'line',
        data: series,
      },
    ],
  };
}

function resolveSeries(value: JSONValue | undefined): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry));
}

function isPlainRecord(value: JSONValue | undefined): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
