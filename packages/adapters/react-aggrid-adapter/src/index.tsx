import React from 'react';
import type { UIComponent } from '@platform/schema';
import { registerAdapter } from '@platform/react-renderer';

export function registerAgGridAdapter(): void {
  registerAdapter('aggrid.', (component) => renderTable(component));
}

function renderTable(component: UIComponent): React.ReactElement {
  const columns = Array.isArray(component.props?.columns) ? component.props?.columns : [];
  const rows = Array.isArray(component.props?.rows) ? component.props?.rows : [];

  return (
    <div aria-label={component.accessibility.ariaLabel}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col: any) => (
              <th key={String(col.field)} style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                {col.headerName ?? col.field}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length || 1} style={{ padding: 8, color: '#666' }}>
                No rows
              </td>
            </tr>
          )}
          {rows.map((row: any, rowIndex: number) => (
            <tr key={row.id ?? rowIndex}>
              {columns.map((col: any) => (
                <td key={String(col.field)} style={{ padding: 6, borderBottom: '1px solid #eee' }}>
                  {String(row[col.field] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
