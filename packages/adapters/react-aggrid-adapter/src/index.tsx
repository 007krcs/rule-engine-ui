import React from 'react';
import type { JSONValue, UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';
import { eventBus } from '@platform/runtime';

type ColumnDef = {
  field: string;
  headerName?: string;
  headerKey?: string;
};

type RowDef = Record<string, JSONValue>;

type FilterChangedEvent = {
  componentId?: string;
  field?: string;
  value?: unknown;
};

let registered = false;
let subscribedToFilters = false;
const activeFilters = new Map<string, FilterChangedEvent>();

export function registerAgGridAdapter(): void {
  if (registered) return;
  registered = true;
  ensureFilterSubscription();
  registerAdapter('aggrid.', (component, ctx) => renderTable(component, ctx));
}

export function renderTable(component: UIComponent, ctx: AdapterContext): React.ReactElement {
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

  const rows: RowDef[] = Array.isArray(rowsSource)
    ? rowsSource.filter((value): value is RowDef => isPlainRecord(value))
    : [];
  const filteredRows = applyFilters(rows, columns, [...activeFilters.values()]);
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
          {filteredRows.length === 0 && (
            <tr>
              <td colSpan={columns.length || 1} style={{ padding: 8, color: '#666' }}>
                No rows
              </td>
            </tr>
          )}
          {filteredRows.map((row, rowIndex) => {
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

export function __resetAgGridFilterState(): void {
  activeFilters.clear();
}

function ensureFilterSubscription(): void {
  if (subscribedToFilters) return;
  subscribedToFilters = true;
  eventBus.subscribe('filterChanged', (data: unknown) => {
    const payload = normalizeFilterPayload(data);
    if (!payload) return;
    const key = payload.componentId ?? payload.field ?? 'default';
    const value = normalizeSearchTerm(payload.value);
    if (!value) {
      activeFilters.delete(key);
      return;
    }
    activeFilters.set(key, payload);
  });
}

function applyFilters(rows: RowDef[], columns: ColumnDef[], filters: FilterChangedEvent[]): RowDef[] {
  const active = filters.filter((filter) => normalizeSearchTerm(filter.value).length > 0);
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((filter) => rowMatchesFilter(row, columns, filter)));
}

function rowMatchesFilter(row: RowDef, columns: ColumnDef[], filter: FilterChangedEvent): boolean {
  const term = normalizeSearchTerm(filter.value);
  if (!term) return true;

  if (filter.field && filter.field in row) {
    return normalizeSearchTerm(row[filter.field]).includes(term);
  }

  const fields = columns.map((column) => column.field);
  if (fields.length === 0) {
    return Object.values(row).some((value) => normalizeSearchTerm(value).includes(term));
  }
  return fields.some((field) => normalizeSearchTerm(row[field]).includes(term));
}

function normalizeSearchTerm(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function normalizeFilterPayload(value: unknown): FilterChangedEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const componentId = typeof record.componentId === 'string' ? record.componentId : undefined;
  const field = typeof record.field === 'string' ? record.field : undefined;
  return {
    componentId,
    field,
    value: record.value,
  };
}

function isPlainRecord(value: JSONValue): value is RowDef {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
