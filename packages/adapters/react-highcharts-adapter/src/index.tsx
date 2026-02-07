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
  return (
    <div
      aria-label={ariaLabel}
      style={{
        border: '1px dashed #999',
        padding: 12,
        minHeight: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Highcharts placeholder: {label}
    </div>
  );
}