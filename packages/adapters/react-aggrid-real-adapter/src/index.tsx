import React from 'react';
import type { JSONValue, UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';
import type { ColDef } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';

let registered = false;

export function registerAgGridRealAdapter(): void {
  if (registered) return;
  registered = true;
  registerAdapter('aggrid.', (component, ctx) => renderGrid(component, ctx));
}

export function registerAgGridAdapter(options?: { enabled?: boolean }): void {
  const enabled =
    options?.enabled ??
    (typeof process !== 'undefined' && process.env?.RULEFLOW_REAL_ADAPTERS === '1');
  if (!enabled) return;
  registerAgGridRealAdapter();
}

function renderGrid(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  const label = component.i18n?.labelKey ? ctx.i18n.t(component.i18n.labelKey) : '';

  const { columns, rows, columnDefs, rowData, defaultColDef, themeClassName, height, ...restProps } =
    (component.props ?? {}) as Record<string, JSONValue>;

  const resolvedColumns = resolveColumnDefs(columns, columnDefs, ctx);
  const resolvedRows = resolveRows(ctx, rows, rowData);
  const resolvedDefaultColDef = isPlainRecord(defaultColDef)
    ? (defaultColDef as ColDef)
    : ({ flex: 1, resizable: true, sortable: true } as ColDef);

  const className = typeof themeClassName === 'string' && themeClassName.trim().length > 0
    ? themeClassName
    : 'ag-theme-alpine';
  const gridHeight = typeof height === 'number' ? height : 280;

  return (
    <div aria-label={ariaLabel} style={{ display: 'grid', gap: 8 }}>
      {label && <div style={{ fontWeight: 600 }}>{label}</div>}
      <div className={className} style={{ width: '100%', minHeight: gridHeight }}>
        <AgGridReact
          rowData={resolvedRows}
          columnDefs={resolvedColumns}
          defaultColDef={resolvedDefaultColDef}
          {...filterGridProps(restProps)}
        />
      </div>
    </div>
  );
}

function resolveRows(
  ctx: AdapterContext,
  rowsProp: JSONValue | undefined,
  rowDataProp: JSONValue | undefined,
): Array<Record<string, JSONValue>> {
  const bound = ctx.bindings.data.rows?.value;
  if (Array.isArray(bound)) {
    return bound.filter((row) => isPlainRecordValue(row)) as Array<Record<string, JSONValue>>;
  }
  if (Array.isArray(rowDataProp)) {
    return rowDataProp.filter((row) => isPlainRecordValue(row)) as Array<Record<string, JSONValue>>;
  }
  if (Array.isArray(rowsProp)) {
    return rowsProp.filter((row) => isPlainRecordValue(row)) as Array<Record<string, JSONValue>>;
  }
  return [];
}

function resolveColumnDefs(
  columnsProp: JSONValue | undefined,
  columnDefsProp: JSONValue | undefined,
  ctx: AdapterContext,
): ColDef[] {
  if (Array.isArray(columnDefsProp)) {
    return columnDefsProp.filter((col) => isPlainRecord(col)) as ColDef[];
  }

  if (!Array.isArray(columnsProp)) return [];
  return columnsProp
    .map((value): ColDef | null => {
      if (!isPlainRecord(value)) return null;
      const field = value.field;
      if (typeof field !== 'string' || field.length === 0) return null;
      const headerName = typeof value.headerName === 'string' ? value.headerName : undefined;
      const headerKey = typeof value.headerKey === 'string' ? value.headerKey : undefined;
      const header = headerKey ? ctx.i18n.t(headerKey) : headerName ?? field;
      return { field, headerName: header };
    })
    .filter((col): col is ColDef => col !== null);
}

function filterGridProps(props: Record<string, JSONValue>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === 'columns' || key === 'rows' || key === 'columnDefs' || key === 'rowData' || key === 'themeClassName') continue;
    output[key] = value as unknown;
  }
  return output;
}

function isPlainRecord(value: JSONValue | undefined): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlainRecordValue(value: JSONValue | undefined): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
