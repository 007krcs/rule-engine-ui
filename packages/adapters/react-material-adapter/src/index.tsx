import React from 'react';
import type { UIComponent } from '@platform/schema';
import { registerAdapter } from '@platform/react-renderer';

export function registerMaterialAdapters(): void {
  registerAdapter('material.', (component, ctx) => renderMaterial(component, ctx));
}

function renderMaterial(
  component: UIComponent,
  ctx: { events: { onChange?: () => void; onClick?: () => void } },
): React.ReactElement {
  switch (component.adapterHint) {
    case 'material.input':
      return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{String(component.props?.label ?? 'Input')}</span>
          <input
            aria-label={component.accessibility.ariaLabel}
            placeholder={String(component.props?.placeholder ?? '')}
            onChange={ctx.events.onChange}
          />
        </label>
      );
    case 'material.button':
      return (
        <button aria-label={component.accessibility.ariaLabel} onClick={ctx.events.onClick}>
          {String(component.props?.label ?? 'Button')}
        </button>
      );
    default:
      return (
        <div data-unsupported>
          Unsupported material component: {component.adapterHint}
        </div>
      );
  }
}
