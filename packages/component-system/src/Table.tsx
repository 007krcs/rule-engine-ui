import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { VirtualList } from './virtualization/VirtualList';
import styles from './Table.module.css';
import { buildDummyRowsFromColumns } from './dummy-data';

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
  virtualized?: boolean;
  height?: number;
  estimateRowHeight?: number;
  retentionKey?: string;
  hasNextPage?: boolean;
  nextCursor?: string | null;
  onRequestNextPage?: (cursor: string | null) => void;
  useDummyDataWhenEmpty?: boolean;
}

export function Table<T>({
  columns = [],
  data = [],
  pageSize,
  ariaLabel = 'Data table',
  emptyMessage = 'No data available',
  getRowId,
  onRowClick,
  virtualized = true,
  height = 420,
  estimateRowHeight = 44,
  retentionKey,
  hasNextPage,
  nextCursor,
  onRequestNextPage,
  useDummyDataWhenEmpty = true,
}: TableProps<T>) {
  if (columns.length === 0) {
    return (
      <div className={styles.tableWrap} role="region" aria-label={ariaLabel}>
        <div className={styles.empty}>No columns configured</div>
      </div>
    );
  }

  const dataset = useMemo(() => {
    if (data.length > 0 || !useDummyDataWhenEmpty) return data;
    return buildDummyRowsFromColumns(
      columns.map((column) => ({ key: String(column.key) })),
      16,
    ) as T[];
  }, [columns, data, useDummyDataWhenEmpty]);

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<TableSortDirection>('asc');

  const sortedData = useMemo(() => {
    if (!sortKey) return dataset;
    const column = columns.find((col) => String(col.key) === sortKey);
    if (!column) return dataset;
    const accessor = column.sortAccessor ?? ((row: T) => (row as any)[column.key]);
    const next = [...dataset];
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
    if (sortDirection === 'desc') next.reverse();
    return next;
  }, [columns, dataset, sortDirection, sortKey]);

  const visibleData = pageSize ? sortedData.slice(0, pageSize) : sortedData;
  const columnTemplate = `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))`;

  const handleSort = (key: string, sortable?: boolean) => () => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleRowKeyDown = (row: T) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onRowClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      onRowClick(row);
      event.preventDefault();
    }
  };

  return (
    <div className={styles.tableWrap} role="region" aria-label={ariaLabel}>
      <div className={styles.headerRow} style={{ display: 'grid', gridTemplateColumns: columnTemplate }}>
        {columns.map((column) => {
          const key = String(column.key);
          const isSorted = sortKey === key;
          const ariaSort =
            column.sortable && isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
          return (
            <div
              key={key}
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
            </div>
          );
        })}
      </div>
      {visibleData.length === 0 ? (
        <div className={styles.empty}>{emptyMessage}</div>
      ) : virtualized ? (
        <VirtualList
          items={visibleData}
          height={height}
          estimateItemHeight={estimateRowHeight}
          overscan={8}
          retentionKey={retentionKey}
          hasNextPage={hasNextPage}
          nextCursor={nextCursor}
          onRequestNextPage={onRequestNextPage}
          getItemKey={(row, index) => getRowId?.(row, index) ?? `row-${index}`}
          renderItem={(row) => (
            <div
              className={[styles.row, onRowClick ? styles.clickable : ''].join(' ').trim()}
              data-testid="table-row"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? handleRowKeyDown(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : 'row'}
              style={{ display: 'grid', gridTemplateColumns: columnTemplate }}
            >
              {columns.map((column) => {
                const value = column.render ? column.render(row) : (row as any)[column.key];
                return (
                  <div key={String(column.key)} className={styles.td} style={{ textAlign: column.align }}>
                    {value ?? ''}
                  </div>
                );
              })}
            </div>
          )}
        />
      ) : (
        <div>
          {visibleData.map((row, index) => {
            const rowId = getRowId?.(row, index) ?? `row-${index}`;
            return (
              <div
                key={rowId}
                className={[styles.row, onRowClick ? styles.clickable : ''].join(' ').trim()}
                data-testid="table-row"
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? handleRowKeyDown(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : 'row'}
                style={{ display: 'grid', gridTemplateColumns: columnTemplate }}
              >
                {columns.map((column) => {
                  const value = column.render ? column.render(row) : (row as any)[column.key];
                  return (
                    <div key={String(column.key)} className={styles.td} style={{ textAlign: column.align }}>
                      {value ?? ''}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
