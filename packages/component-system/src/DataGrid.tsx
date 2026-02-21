import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GridCore,
  type GroupNode,
  type GridColumnState,
  isGroupNode,
  type AggregationConfig,
  type GridDataSourceQuery,
  type GridDataSourceResult,
} from '@platform/data-grid';
import { VirtualGrid } from './virtualization/VirtualGrid';
import styles from './DataGrid.module.css';
import { buildDummyRowsFromColumns } from './dummy-data';

export interface DataGridColumn<T extends Record<string, unknown>> {
  key: keyof T | string;
  title: string;
  render?: (row: T) => ReactNode;
  sparkline?: boolean;
}

export interface DataGridProps<T extends Record<string, unknown>> {
  columns: Array<DataGridColumn<T>>;
  rows: T[];
  height?: number;
  retentionKey?: string;
  columnStateKey?: string;
  columnState?: GridColumnState[];
  hasNextPage?: boolean;
  nextCursor?: string | null;
  onRequestNextPage?: (cursor: string | null) => void;
  getRowId?: (row: T, index: number) => string;
  grouping?: {
    enabled?: boolean;
    keys?: string[];
  };
  pivot?: {
    enabled?: boolean;
    rowKey?: string;
    pivotKey?: string;
    valueKey?: string;
    aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  };
  aggregation?: {
    enabled?: boolean;
    config?: AggregationConfig;
  };
  serverSide?: {
    enabled?: boolean;
    query?: GridDataSourceQuery;
    fetchRows?: (query: GridDataSourceQuery) => Promise<GridDataSourceResult<T>>;
  };
  useDummyDataWhenEmpty?: boolean;
}

export function DataGrid<T extends Record<string, unknown>>({
  columns,
  rows,
  height = 420,
  retentionKey,
  columnStateKey,
  columnState,
  hasNextPage,
  nextCursor,
  onRequestNextPage,
  getRowId,
  grouping,
  pivot,
  aggregation,
  serverSide,
  useDummyDataWhenEmpty = true,
}: DataGridProps<T>) {
  const [resolvedRows, setResolvedRows] = useState<T[]>(rows);

  useEffect(() => {
    if (!serverSide?.enabled || !serverSide.fetchRows) {
      setResolvedRows(rows);
      return;
    }
    let active = true;
    void serverSide.fetchRows(serverSide.query ?? {}).then((result) => {
      if (!active) return;
      setResolvedRows(result.rows);
    });
    return () => {
      active = false;
    };
  }, [rows, serverSide]);

  const dataset = useMemo(() => {
    if (resolvedRows.length > 0 || !useDummyDataWhenEmpty) return resolvedRows;
    return buildDummyRowsFromColumns(
      columns.map((column) => ({ key: String(column.key) })),
      20,
    ) as T[];
  }, [columns, resolvedRows, useDummyDataWhenEmpty]);

  const core = useMemo(
    () =>
      new GridCore<T>({
        rows: dataset,
        columns: columns.map((column) => ({
          key: String(column.key),
          title: column.title,
          sparkline: column.sparkline,
        })),
        grouping,
        pivot: pivot?.enabled
          ? {
              enabled: true,
              config:
                pivot.rowKey && pivot.pivotKey && pivot.valueKey
                  ? {
                      rowKey: pivot.rowKey,
                      pivotKey: pivot.pivotKey,
                      valueKey: pivot.valueKey,
                      aggregation: pivot.aggregation,
                    }
                  : undefined,
            }
          : undefined,
        aggregation,
        serverSide,
        columnStateKey: columnStateKey ?? retentionKey,
      }),
    [aggregation, columnStateKey, columns, dataset, grouping, pivot, retentionKey, serverSide],
  );
  useEffect(() => {
    if (!columnState || columnState.length === 0) return;
    core.saveColumnState(columnState);
  }, [columnState, core]);
  const view = useMemo(() => core.prepareView(), [core]);
  const viewRows = view.rows;
  const renderColumns = useMemo<Array<{ key: string; title: string; sparkline?: boolean; render?: (row: T) => ReactNode }>>(() => {
    const sourceMap = new Map(columns.map((column) => [String(column.key), column]));
    if (view.columns.length > 0) {
      return view.columns.map((column) => {
        const source = sourceMap.get(String(column.key));
        return {
          key: String(column.key),
          title: column.title,
          sparkline: column.sparkline ?? source?.sparkline,
          render: source?.render,
        };
      });
    }
    return columns.map((column) => ({
      key: String(column.key),
      title: column.title,
      sparkline: column.sparkline,
      render: column.render,
    }));
  }, [columns, view.columns]);

  return (
    <div className={styles.gridWrap} role="grid" aria-rowcount={viewRows.length}>
      <div
        className={styles.header}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, renderColumns.length)}, minmax(0, 1fr))` }}
      >
        {renderColumns.map((column) => (
          <div key={String(column.key)} className={styles.headCell}>
            {column.title}
          </div>
        ))}
      </div>
      <VirtualGrid<T | GroupNode<T>>
        items={viewRows}
        height={height}
        columnCount={1}
        estimateRowHeight={46}
        retentionKey={retentionKey}
        hasNextPage={hasNextPage}
        nextCursor={nextCursor}
        onRequestNextPage={onRequestNextPage}
        getItemKey={(row, index) => {
          if (isGroupNode<T>(row)) return `group-${row.id}`;
          return getRowId?.(row, index) ?? `row-${index}`;
        }}
        renderCell={(row, index) => {
          if (isGroupNode<T>(row)) {
            return (
              <div className={styles.groupRow}>
                <span>{`${row.key}: ${row.value}`}</span>
                <span className={styles.groupMeta}>{`${row.rows.length} rows`}</span>
              </div>
            );
          }

          const rowKey = getRowId?.(row, index) ?? String((row as Record<string, unknown>).id ?? index);
          return (
            <div
              className={styles.row}
              style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, renderColumns.length)}, minmax(0, 1fr))` }}
            >
              {renderColumns.map((column) => {
                const dataKey = String(column.key);
                const rawValue = row[dataKey];
                const sparkPath = view.sparklineByRowId[rowKey]?.[dataKey];
                const value =
                  column.render?.(row) ??
                  (column.sparkline && sparkPath ? (
                    <svg width="84" height="24" viewBox="0 0 84 24" role="img" aria-label={`${column.title} trend`}>
                      <path d={sparkPath} fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  ) : (
                    (rawValue as ReactNode)
                  ));
                return (
                  <div key={dataKey} className={styles.cell}>
                    {value ?? ''}
                  </div>
                );
              })}
            </div>
          );
        }}
      />
      {view.summary ? (
        <div className={styles.summaryRow}>
          {renderColumns.map((column) => {
            const key = String(column.key);
            const value = view.summary?.[key];
            return (
              <div key={`summary-${key}`} className={styles.summaryCell}>
                {value == null ? '' : String(value)}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
