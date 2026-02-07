import React from 'react';
import type { UIComponent } from '@platform/schema';
import { registerAdapter } from '@platform/react-renderer';

export function registerD3Adapter(): void {
  registerAdapter('d3.', (component) => renderD3(component));
}

function renderD3(component: UIComponent): React.ReactElement {
  return (
    <div
      aria-label={component.accessibility.ariaLabel}
      style={{
        border: '1px dashed #4b9',
        padding: 12,
        minHeight: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      D3 mount point: {component.id}
    </div>
  );
}
