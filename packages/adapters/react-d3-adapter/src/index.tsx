import React from 'react';
import type { UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';

let registered = false;

export function registerD3Adapter(): void {
  if (registered) return;
  registered = true;
  registerAdapter('d3.', (component, ctx) => renderD3(component, ctx));
}

function renderD3(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  const label = component.i18n?.labelKey ? ctx.i18n.t(component.i18n.labelKey) : component.id;
  const series = resolveSeries(component, ctx);
  const width = 260;
  const height = 120;
  const padding = 16;
  const chart = buildLinePath(series, width, height, padding);
  return (
    <div
      aria-label={ariaLabel}
      style={{
        border: '1px dashed #4b9',
        padding: 12,
        minHeight: 180,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 12, color: '#2a6' }}>D3 Inline Sparkline</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      {series.length === 0 ? (
        <div style={{ fontSize: 12, color: '#666' }}>No series data provided.</div>
      ) : (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
          <path d={chart.path} fill="none" stroke="#22c55e" strokeWidth={2} />
          {chart.points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={3} fill="#16a34a" />
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

function buildLinePath(series: number[], width: number, height: number, padding: number) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const step = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0;
  const points = series.map((value, index) => {
    const x = padding + index * step;
    const y = height - padding - ((value - min) / span) * (height - padding * 2);
    return { x, y };
  });
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');
  return { path, points };
}
