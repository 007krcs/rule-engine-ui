import React from 'react';
import type { UIComponent } from '@platform/schema';
import { registerAdapter } from '@platform/react-renderer';

export function registerHighchartsAdapter(): void {
  registerAdapter('highcharts.', (component) => renderChart(component));
}

function renderChart(component: UIComponent): React.ReactElement {
  return (
    <div
      aria-label={component.accessibility.ariaLabel}
      style={{
        border: '1px dashed #999',
        padding: 12,
        minHeight: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Highcharts placeholder: {String(component.props?.title ?? component.id)}
    </div>
  );
}
