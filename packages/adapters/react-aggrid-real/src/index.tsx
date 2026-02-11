import React from 'react';
import type { ColDef } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { registerAdapter, type AdapterContext } from '@platform/react-renderer';
import type { JSONValue, UIComponent } from '@platform/schema';

let registered = false;

export function registerAgGridRealAdapter(): void {
  if (registered) return;
  registered = true;
  registerAdapter('aggrid.', (component, ctx) => renderAgGrid(component, ctx));
}

export function registerAgGridAdapter(options?: { enabled?: boolean }): void {
  const enabled = options?.enabled ?? (typeof process !== 'undefined' && process.env?.RULEFLOW_REAL_ADAPTERS === '1');
  if (!enabled) return;
  registerAgGridRealAdapter();
}

function renderAgGrid(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  const props = (component.props ?? {}) as Record<string, JSONValue>;

  const rowData = toRowData(ctx.bindings.data.rows?.value ?? props.rowData ?? props.rows);
  const columnDefs = toColumnDefs(props.columnDefs ?? props.columns);

  return (
    <div aria-label={ariaLabel} style={{ minHeight: 280, width: '100%' }}>
      <AgGridReact rowData={rowData} columnDefs={columnDefs} />
    </div>
  );
}

function toRowData(value: JSONValue | undefined): Array<Record<string, JSONValue>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => isPlainRecord(item)) as Array<Record<string, JSONValue>>;
}

function toColumnDefs(value: JSONValue | undefined): ColDef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): ColDef | null => {
      if (!isPlainRecord(entry)) return null;
      const field = entry.field;
      if (typeof field !== 'string' || field.length === 0) return null;
      const headerName = typeof entry.headerName === 'string' ? entry.headerName : undefined;
      return { ...entry, field, headerName } as ColDef;
    })
    .filter((entry): entry is ColDef => entry !== null);
}

function isPlainRecord(value: JSONValue | undefined): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
