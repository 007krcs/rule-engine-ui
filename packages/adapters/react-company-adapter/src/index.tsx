import React from 'react';
import type { JSONValue, UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';

export function registerCompanyAdapter(): void {
  registerAdapter('company.', (component, ctx) => renderCompany(component, ctx));
}

function renderCompany(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  const label = component.i18n?.labelKey
    ? ctx.i18n.t(component.i18n.labelKey)
    : String(component.props?.label ?? component.id);
  const metrics = Array.isArray(component.props?.metrics)
    ? component.props?.metrics
        .map((item) => {
          if (!isPlainRecord(item)) return null;
          const metricLabel = typeof item.label === 'string' ? item.label : undefined;
          const metricValue: JSONValue = item.value ?? '';
          return metricLabel ? { label: metricLabel, value: metricValue } : null;
        })
        .filter((item): item is { label: string; value: Exclude<JSONValue, null> } => item !== null)
    : [];
  const details = isPlainRecord(component.props?.details) ? component.props?.details : {};

  return (
    <div
      aria-label={ariaLabel}
      style={{
        border: '1px solid #222',
        padding: 16,
        borderRadius: 12,
        background: '#f8f8f8',
        display: 'grid',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#666' }}>Company Lens</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{label}</div>
      </div>
      {metrics.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          {metrics.map((metric) => (
            <div key={metric.label} style={{ background: '#fff', padding: 8, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#666' }}>{metric.label}</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{stringify(metric.value)}</div>
            </div>
          ))}
        </div>
      )}
      {Object.keys(details).length > 0 && (
        <div style={{ fontSize: 12, color: '#444' }}>
          {Object.entries(details).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{key}</span>
              <span>{stringify(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isPlainRecord(value: unknown): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
