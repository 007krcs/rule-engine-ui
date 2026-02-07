import React from 'react';
import type { UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';

export function registerD3Adapter(): void {
  registerAdapter('d3.', (component, ctx) => renderD3(component, ctx));
}

function renderD3(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  const label = component.i18n?.labelKey ? ctx.i18n.t(component.i18n.labelKey) : component.id;
  return (
    <div
      aria-label={ariaLabel}
      style={{
        border: '1px dashed #4b9',
        padding: 12,
        minHeight: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      D3 mount point: {label}
    </div>
  );
}