import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Table.module.css';

export type TableSortDirection = 'asc' | 'desc';

export interface TableColumn<T> {
  key: keyof T | string;
  title: string;
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => ReactNode;
  sortAccessor?: (row: T) => string | number | null | undefined;
}

export interface TableProps<T> {
  columns?: Array<TableColumn<T>>;
  data?: T[];
  pageSize?: number;
  ariaLabel?: string;
  emptyMessage?: string;
  getRowId?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
  columns = [],
  data = [],
  pageSize,
  ariaLabel = 'Data table',
  emptyMessage = 'No data available',
  getRowId,
  onRowClick,
}: TableProps<T>) {
  if (columns.length === 0) {
    return (
      <div className={styles.tableWrap} role="region" aria-label={ariaLabel}>
        <div className={styles.empty}>No columns configured</div>
      </div>
    );
  }
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<TableSortDirection>('asc');

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const column = columns.find((col) => String(col.key) === sortKey);
    if (!column) return data;
    const accessor = column.sortAccessor ?? ((row: T) => (row as any)[column.key]);
    const next = [...data];
    next.sort((left, right) => {
      const leftValue = accessor(left);
      const rightValue = accessor(right);
      if (leftValue == null && rightValue == null) return 0;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return leftValue - rightValue;
      }
      return String(leftValue).localeCompare(String(rightValue));
    });
    if (sortDirection === 'desc') {
      next.reverse();
    }
    return next;
  }, [columns, data, sortKey, sortDirection]);

  const visibleData = pageSize ? sortedData.slice(0, pageSize) : sortedData;

  const handleSort = (key: string, sortable?: boolean) => () => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleRowKeyDown = (row: T) => (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (!onRowClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      onRowClick(row);
      event.preventDefault();
    }
  };

  return (
    <div className={styles.tableWrap} role="region" aria-label={ariaLabel}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            {columns.map((column) => {
              const key = String(column.key);
              const isSorted = sortKey === key;
              const ariaSort = column.sortable && isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
              return (
                <th
                  key={key}
                  scope="col"
                  className={styles.th}
                  style={{ width: column.width, textAlign: column.align }}
                  aria-sort={column.sortable ? ariaSort : undefined}
                >
                  {column.sortable ? (
                    <button type="button" className={styles.sortButton} onClick={handleSort(key, column.sortable)}>
                      {column.title}
                      <span className={styles.sortIndicator} aria-hidden="true">
                        {isSorted ? (sortDirection === 'asc' ? 'ASC' : 'DESC') : 'SORT'}
                      </span>
                    </button>
                  ) : (
                    column.title
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visibleData.length === 0 ? (
            <tr>
              <td className={styles.empty} colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            visibleData.map((row, index) => {
              const rowId = getRowId?.(row, index) ?? `row-${index}`;
              return (
                <tr
                  key={rowId}
                  className={[styles.row, onRowClick ? styles.clickable : ''].join(' ').trim()}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? handleRowKeyDown(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                >
                  {columns.map((column) => {
                    const cell = column.render ? column.render(row) : (row as any)[column.key];
                    return (
                      <td
                        key={`${rowId}-${String(column.key)}`}
                        className={styles.td}
                        style={{ textAlign: column.align }}
                      >
                        {cell ?? ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
