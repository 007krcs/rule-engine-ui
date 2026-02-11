import React from 'react';
import type { JSONValue, UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';

let registered = false;

export function registerCompanyAdapter(): void {
  if (registered) return;
  registered = true;
  registerAdapter('company.', (component, ctx) => renderCompany(component, ctx));
}

function renderCompany(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  const label = component.i18n?.labelKey ? ctx.i18n.t(component.i18n.labelKey) : String(component.props?.label ?? component.id);

  switch (component.adapterHint) {
    case 'company.currencyInput': {
      const currency = typeof component.props?.currency === 'string' ? component.props.currency : 'USD';
      const min = typeof component.props?.min === 'number' ? component.props.min : undefined;
      const max = typeof component.props?.max === 'number' ? component.props.max : undefined;
      const boundValue = resolveBindingValue(component, ctx, 'data', 'value');
      const valueText = boundValue !== undefined ? stringify(boundValue) : '';
      const binding = component.bindings?.data?.value ?? '';

      return (
        <label aria-label={ariaLabel} style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 750 }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 10px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                background: '#f9fafb',
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.04em',
              }}
            >
              {currency}
            </span>
            <input
              type="number"
              defaultValue={valueText}
              min={min}
              max={max}
              placeholder="0.00"
              style={{
                flex: 1,
                borderRadius: 10,
                border: '1px solid #d1d5db',
                padding: '10px 12px',
                fontSize: 14,
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Bound to{' '}
            <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{binding || '(none)'}</code>
          </span>
        </label>
      );
    }
    case 'company.riskBadge': {
      const boundLevel = resolveBindingValue(component, ctx, 'data', 'level');
      const level =
        typeof boundLevel === 'string' ? boundLevel : typeof component.props?.level === 'string' ? component.props.level : 'Low';
      const colors = resolveRiskColors(level);

      return (
        <div aria-label={ariaLabel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 750 }}>{label}</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              background: colors.bg,
              color: colors.fg,
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: '0.02em',
            }}
            title="Risk level (demo)"
          >
            {level}
          </span>
        </div>
      );
    }
    default: {
      // Backwards compatible fallback used by older examples/tests (`company.card`).
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
  }
}

function resolveBindingValue(
  component: UIComponent,
  ctx: AdapterContext,
  group: 'data' | 'context' | 'computed',
  key: string,
): JSONValue | undefined {
  const bindings = component.bindings?.[group];
  const path = bindings && typeof bindings[key] === 'string' ? bindings[key] : '';
  if (!path) return undefined;

  if (path.startsWith('data.')) return getPath(ctx.data, path.slice('data.'.length));
  if (path.startsWith('context.')) return getPath(ctx.context as unknown as Record<string, JSONValue>, path.slice('context.'.length));
  return getPath(ctx.data, path);
}

function resolveRiskColors(level: string): { bg: string; border: string; fg: string } {
  const normalized = level.toLowerCase();
  if (normalized === 'high') return { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b' };
  if (normalized === 'medium') return { bg: '#fffbeb', border: '#fde68a', fg: '#92400e' };
  return { bg: '#ecfdf5', border: '#a7f3d0', fg: '#065f46' };
}

function getPath(obj: Record<string, JSONValue>, path: string): JSONValue | undefined {
  if (!path) return obj as unknown as JSONValue;
  const parts = path.replace(/\\[(\\d+)\\]/g, '.$1').split('.').filter(Boolean);

  let current: JSONValue | undefined = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const index = Number(part);
    if (!Number.isNaN(index) && Array.isArray(current)) {
      current = current[index];
      continue;
    }
    if (typeof current !== 'object' || Array.isArray(current)) return undefined;
    if (isUnsafeKey(part)) return undefined;
    current = (current as Record<string, JSONValue>)[part];
  }
  return current;
}

function isUnsafeKey(value: string): boolean {
  return value === '__proto__' || value === 'constructor' || value === 'prototype';
}

function isPlainRecord(value: unknown): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

