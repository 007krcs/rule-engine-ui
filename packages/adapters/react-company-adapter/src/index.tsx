import React from 'react';
import type { UIComponent } from '@platform/schema';
import { registerAdapter } from '@platform/react-renderer';

export function registerCompanyAdapter(): void {
  registerAdapter('company.', (component) => renderCompany(component));
}

function renderCompany(component: UIComponent): React.ReactElement {
  return (
    <div
      aria-label={component.accessibility.ariaLabel}
      style={{ border: '1px solid #222', padding: 12, background: '#f8f8f8' }}
    >
      Company component placeholder: {String(component.props?.label ?? component.id)}
    </div>
  );
}
