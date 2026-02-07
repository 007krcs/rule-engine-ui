import React from 'react';
import type { UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';

type ColumnDef = {
  field: string;
  headerName?: string;
  headerKey?: string;
};

type RowDef = Record<string, unknown>;

export function registerAgGridAdapter(): void {
  registerAdapter('aggrid.', (component, ctx) => renderTable(component, ctx));
}

function renderTable(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const columnsSource = component.props?.columns;
  const rowsSource = component.props?.rows;

  const columns = Array.isArray(columnsSource)
    ? columnsSource
        .map((value): ColumnDef | null => {
          if (!isPlainRecord(value)) return null;
          const field = value.field;
          if (typeof field !== 'string' || field.length === 0) return null;
          const headerName = typeof value.headerName === 'string' ? value.headerName : undefined;
          const headerKey = typeof value.headerKey === 'string' ? value.headerKey : undefined;
          return { field, headerName, headerKey };
        })
        .filter((col): col is ColumnDef => col !== null)
    : [];

  const rows = Array.isArray(rowsSource) ? rowsSource.filter(isPlainRecord) : [];
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  const label = component.i18n?.labelKey ? ctx.i18n.t(component.i18n.labelKey) : '';

  return (
    <div aria-label={ariaLabel}>
      {label && <div style={{ fontWeight: 600, marginBottom: 8 }}>{label}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => {
              const header = col.headerKey ? ctx.i18n.t(col.headerKey) : col.headerName ?? col.field;
              return (
                <th key={String(col.field)} style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                  {header}
                </th>
              );
            })}
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
          {rows.map((row, rowIndex) => {
            const rowId = row.id;
            const rowKey = typeof rowId === 'string' || typeof rowId === 'number' ? rowId : rowIndex;
            return (
              <tr key={rowKey}>
                {columns.map((col) => (
                  <td key={String(col.field)} style={{ padding: 6, borderBottom: '1px solid #eee' }}>
                    {String(row[col.field] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function isPlainRecord(value: unknown): value is RowDef {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}