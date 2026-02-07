import React from 'react';
import type { UIComponent } from '@platform/schema';
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
  return (
    <div
      aria-label={ariaLabel}
      style={{ border: '1px solid #222', padding: 12, background: '#f8f8f8' }}
    >
      Company component placeholder: {label}
    </div>
  );
}