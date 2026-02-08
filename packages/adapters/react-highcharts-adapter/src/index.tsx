import React from 'react';
import type { UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';

export function registerHighchartsAdapter(): void {
  registerAdapter('highcharts.', (component, ctx) => renderChart(component, ctx));
}

function renderChart(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  const label = component.i18n?.labelKey
    ? ctx.i18n.t(component.i18n.labelKey)
    : String(component.props?.title ?? component.id);
  const series = resolveSeries(component, ctx);
  const width = 260;
  const height = 140;
  const padding = 16;
  const bars = buildBars(series, width, height, padding);
  return (
    <div
      aria-label={ariaLabel}
      style={{
        border: '1px dashed #999',
        padding: 12,
        minHeight: 200,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 12, color: '#555' }}>Highcharts Inline Bars</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      {series.length === 0 ? (
        <div style={{ fontSize: 12, color: '#666' }}>No series data provided.</div>
      ) : (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
          {bars.map((bar, index) => (
            <rect
              key={index}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={3}
              fill="#60a5fa"
            />
          ))}
        </svg>
      )}
    </div>
  );
}

function resolveSeries(component: UIComponent, ctx: AdapterContext): number[] {
  const fromProps = component.props?.series;
  if (Array.isArray(fromProps)) {
    return fromProps.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }
  const fallback = ctx.data.revenueSeries ?? ctx.data.customViz;
  if (Array.isArray(fallback)) {
    return fallback.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }
  return [];
}

function buildBars(series: number[], width: number, height: number, padding: number) {
  const max = Math.max(...series, 0);
  const barWidth = series.length > 0 ? (width - padding * 2) / series.length : width;
  return series.map((value, index) => {
    const normalized = max === 0 ? 0 : value / max;
    const barHeight = normalized * (height - padding * 2);
    const x = padding + index * barWidth + barWidth * 0.1;
    const y = height - padding - barHeight;
    return { x, y, width: barWidth * 0.8, height: barHeight };
  });
}
