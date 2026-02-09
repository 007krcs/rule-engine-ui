import React from 'react';
import type { UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';

let registered = false;

export function registerMaterialAdapters(): void {
  if (registered) return;
  registered = true;
  registerAdapter('material.', (component, ctx) => renderMaterial(component, ctx));
}

function renderMaterial(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  switch (component.adapterHint) {
    case 'material.input': {
      const label = component.i18n?.labelKey
        ? ctx.i18n.t(component.i18n.labelKey)
        : String(component.props?.label ?? 'Input');
      const placeholder = component.i18n?.placeholderKey
        ? ctx.i18n.t(component.i18n.placeholderKey)
        : String(component.props?.placeholder ?? '');
      const helperText = component.i18n?.helperTextKey
        ? ctx.i18n.t(component.i18n.helperTextKey)
        : String(component.props?.helperText ?? '');
      return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{label}</span>
          <input aria-label={ariaLabel} placeholder={placeholder} onChange={ctx.events.onChange} />
          {helperText && <small style={{ color: '#666' }}>{helperText}</small>}
        </label>
      );
    }
    case 'material.button': {
      const label = component.i18n?.labelKey
        ? ctx.i18n.t(component.i18n.labelKey)
        : String(component.props?.label ?? 'Button');
      return (
        <button aria-label={ariaLabel} onClick={ctx.events.onClick}>
          {label}
        </button>
      );
    }
    default:
      return (
        <div data-unsupported>
          Unsupported material component: {component.adapterHint}
        </div>
      );
  }
}
