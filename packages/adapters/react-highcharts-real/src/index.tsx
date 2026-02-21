import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { registerAdapter, type AdapterContext } from '@platform/react-renderer';
import { createChartRenderer, type IndicatorConfig } from '@platform/chart-engine';
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
  const config = resolveChartConfig(component, props.config, props.options, ctx);

  return (
    <div aria-label={ariaLabel}>
      <HighchartsReact highcharts={Highcharts} options={config} />
    </div>
  );
}

function resolveChartConfig(
  component: UIComponent,
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

  const sourceSeries = resolveSeries(ctx.bindings.data.series?.value ?? component.props?.series);
  const indicators = resolveIndicators(component.props?.indicators);
  const chartEngine = createChartRenderer({
    chartId: component.id,
    series: sourceSeries,
    indicators,
  });
  const indicatorOverlays = chartEngine.overlays.map((overlay) =>
    toOverlaySeries(overlay.id, overlay.values, 'line'),
  );
  const configuredOverlays = resolveConfiguredOverlays(component.props?.overlays, chartEngine.baseSeries);

  const multiAxis = resolveMultiAxis(component.props?.multiAxis);
  return {
    title: { text: 'Chart' },
    chart: {
      events: {
        selection: (event) => {
          const min = Number(event.xAxis?.[0]?.min ?? 0);
          const max = Number(event.xAxis?.[0]?.max ?? 0);
          chartEngine.emitBrush(min, max);
          return undefined;
        },
      },
    },
    yAxis: multiAxis,
    plotOptions: {
      series: {
        events: {
          legendItemClick: function () {
            const state = this as Highcharts.Series;
            chartEngine.emitLegendToggle(state.name, !state.visible);
            return true;
          },
        },
        point: {
          events: {
            click: function () {
              const point = this as Highcharts.Point;
              chartEngine.emitDrillDown(point.index);
            },
            mouseOver: function () {
              const point = this as Highcharts.Point;
              chartEngine.emitCrosshairMove(point.index);
            },
          },
        },
      },
    },
    series: [
      {
        type: 'line',
        name: component.i18n?.labelKey
          ? ctx.i18n.t(component.i18n.labelKey)
          : String(component.props?.title ?? component.id),
        data: chartEngine.baseSeries,
      },
      ...indicatorOverlays,
      ...configuredOverlays,
    ],
  };
}

function resolveSeries(value: JSONValue | undefined): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry));
}

function resolveIndicators(raw: unknown): IndicatorConfig[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const indicators: IndicatorConfig[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const type = record.type;
    if (type !== 'SMA' && type !== 'EMA' && type !== 'RSI' && type !== 'MACD' && type !== 'BOLLINGER') {
      continue;
    }
    indicators.push({
      type,
      period: asFiniteNumber(record.period),
      fastPeriod: asFiniteNumber(record.fastPeriod),
      slowPeriod: asFiniteNumber(record.slowPeriod),
      signalPeriod: asFiniteNumber(record.signalPeriod),
      stdDev: asFiniteNumber(record.stdDev),
    });
  }
  return indicators.length > 0 ? indicators : undefined;
}

function resolveMultiAxis(raw: unknown): Highcharts.YAxisOptions[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [{}];
  const record = raw as Record<string, unknown>;
  if (!record.enabled) return [{}];
  return [
    { title: { text: typeof record.leftTitle === 'string' ? record.leftTitle : undefined } },
    { title: { text: typeof record.rightTitle === 'string' ? record.rightTitle : undefined }, opposite: true },
  ];
}

function resolveConfiguredOverlays(raw: unknown, base: number[]): Highcharts.SeriesLineOptions[] {
  if (!Array.isArray(raw)) return [];
  const overlays: Highcharts.SeriesLineOptions[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const overlay = entry as Record<string, unknown>;
    const id = typeof overlay.id === 'string' ? overlay.id : 'Overlay';
    const type = overlay.type === 'area' ? 'area' : overlay.type === 'band' ? 'line' : 'line';
    const axis = overlay.axis === 'right' ? 1 : 0;
    const color = typeof overlay.color === 'string' ? overlay.color : undefined;
    overlays.push({
      type,
      name: id,
      yAxis: axis,
      color,
      data: base,
      linkedTo: ':previous',
      lineWidth: type === 'line' ? 1 : undefined,
    } as Highcharts.SeriesLineOptions);
  }
  return overlays;
}

function toOverlaySeries(
  name: string,
  values: Array<number | null>,
  type: 'line' | 'area',
): Highcharts.SeriesLineOptions {
  return {
    type,
    name,
    data: values.map((value) => (value === null ? null : Number(value))),
    linkedTo: ':previous',
    lineWidth: 1,
  } as Highcharts.SeriesLineOptions;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function isPlainRecord(value: JSONValue | undefined): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
