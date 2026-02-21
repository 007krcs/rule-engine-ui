import React from 'react';
import { createChartRenderer, type IndicatorConfig } from '@platform/chart-engine';
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
  const indicators = resolveIndicators(component.props?.indicators);
  const renderer = createChartRenderer({ chartId: component.id, series, indicators });
  const overlays = renderer.overlays.map((overlay) => ({
    type: 'line' as const,
    name: overlay.id,
    data: overlay.values.map((value) => (value === null ? null : Number(value))),
    yAxis: 0,
  }));
  const configuredOverlays = resolveConfiguredOverlays(component.props?.overlays, renderer.baseSeries);

  const multiAxis = resolveMultiAxis(component.props?.multiAxis);
  return {
    title: { text: label },
    chart: {
      events: {
        selection: (event) => {
          const min = Number(event.xAxis?.[0]?.min ?? 0);
          const max = Number(event.xAxis?.[0]?.max ?? 0);
          renderer.emitBrush(min, max);
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
            renderer.emitLegendToggle(state.name, !state.visible);
            return true;
          },
        },
        point: {
          events: {
            click: function () {
              const point = this as Highcharts.Point;
              renderer.emitDrillDown(point.index);
            },
            mouseOver: function () {
              const point = this as Highcharts.Point;
              renderer.emitCrosshairMove(point.index);
            },
          },
        },
      },
    },
    series: [
      {
        type: 'line',
        name: label,
        data: renderer.baseSeries,
      },
      ...overlays,
      ...configuredOverlays,
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

function resolveIndicators(raw: unknown): IndicatorConfig[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const indicators: IndicatorConfig[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const type = record.type;
    if (type !== 'SMA' && type !== 'EMA' && type !== 'RSI' && type !== 'MACD' && type !== 'BOLLINGER') continue;
    indicators.push({
      type,
      period: toNumber(record.period),
      fastPeriod: toNumber(record.fastPeriod),
      slowPeriod: toNumber(record.slowPeriod),
      signalPeriod: toNumber(record.signalPeriod),
      stdDev: toNumber(record.stdDev),
    });
  }
  return indicators.length > 0 ? indicators : undefined;
}

function resolveMultiAxis(raw: unknown): Highcharts.YAxisOptions[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [{}];
  const record = raw as Record<string, unknown>;
  const enabled = Boolean(record.enabled);
  if (!enabled) return [{}];
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

function toNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}
