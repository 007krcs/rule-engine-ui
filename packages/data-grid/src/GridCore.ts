import { aggregateRows, type AggregationConfig, type AggregationResult } from './AggregationEngine';
import { exportToCsv, exportToExcelXml } from './ExportEngine';
import { flattenGroups, groupRows, isGroupNode, type GroupNode } from './GroupingEngine';
import { pivotRows, type PivotConfig } from './PivotEngine';

export interface GridColumnState {
  key: string;
  width?: number;
  hidden?: boolean;
  pinned?: 'left' | 'right';
  order?: number;
}

export interface GridColumn<Row extends Record<string, unknown>> {
  key: keyof Row | string;
  title: string;
  groupable?: boolean;
  pivotable?: boolean;
  aggregatable?: boolean;
  sparkline?: boolean;
}

export interface GridDataSourceQuery {
  cursor?: string | null;
  pageSize?: number;
  sort?: Array<{ key: string; direction: 'asc' | 'desc' }>;
  filters?: Record<string, unknown>;
}

export interface GridDataSourceResult<Row extends Record<string, unknown>> {
  rows: Row[];
  total?: number;
  cursor?: string | null;
}

export interface GridServerSideMode<Row extends Record<string, unknown>> {
  enabled?: boolean;
  query?: GridDataSourceQuery;
  fetchRows?: (query: GridDataSourceQuery) => Promise<GridDataSourceResult<Row>>;
}

export interface GridCoreOptions<Row extends Record<string, unknown>> {
  rows: Row[];
  columns: Array<GridColumn<Row>>;
  grouping?: {
    enabled?: boolean;
    keys?: string[];
  };
  pivot?: {
    enabled?: boolean;
    config?: PivotConfig;
  };
  aggregation?: {
    enabled?: boolean;
    config?: AggregationConfig;
  };
  serverSide?: GridServerSideMode<Row>;
  columnStateKey?: string;
  storage?: ColumnStateStorage;
}

export interface GridCoreView<Row extends Record<string, unknown>> {
  rows: Array<Row | GroupNode<Row>>;
  columns: Array<GridColumn<Row>>;
  groupedRows: GroupNode<Row>[];
  pivotColumns: string[];
  summary?: AggregationResult;
  sparklineByRowId: Record<string, Record<string, string>>;
}

export interface ColumnStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class GridCore<Row extends Record<string, unknown>> {
  constructor(private readonly options: GridCoreOptions<Row>) {}

  prepareView(): GridCoreView<Row> {
    const baseRows = this.options.rows;
    const sourceColumns = this.applyColumnState(this.options.columns);
    let columns = sourceColumns;
    let workingRows: Row[] = baseRows;
    let groupedRows: GroupNode<Row>[] = [];
    let pivotColumns: string[] = [];
    let summary: AggregationResult | undefined;

    if (this.options.pivot?.enabled && this.options.pivot.config) {
      const result = pivotRows(workingRows, this.options.pivot.config);
      pivotColumns = result.columns;
      workingRows = result.rows as Row[];
      const sourceByKey = new Map(sourceColumns.map((column) => [String(column.key), column]));
      columns = pivotColumns.map((key) => {
        const source = sourceByKey.get(key);
        return {
          key,
          title: source?.title ?? key,
          sparkline: source?.sparkline,
          groupable: source?.groupable,
          pivotable: source?.pivotable,
          aggregatable: source?.aggregatable,
        };
      });
    }

    if (this.options.grouping?.enabled && (this.options.grouping.keys?.length ?? 0) > 0) {
      groupedRows = groupRows(workingRows, {
        keys: this.options.grouping.keys ?? [],
        aggregation: this.options.aggregation?.enabled ? this.options.aggregation.config : undefined,
      });
    }

    if (this.options.aggregation?.enabled && this.options.aggregation.config) {
      summary = aggregateRows(workingRows, this.options.aggregation.config);
    }

    const renderedRows = groupedRows.length > 0 ? flattenGroups(groupedRows) : workingRows;
    return {
      rows: renderedRows,
      columns,
      groupedRows,
      pivotColumns,
      summary,
      sparklineByRowId: buildSparklines(renderedRows, columns),
    };
  }

  async fetchServerRows(): Promise<GridDataSourceResult<Row>> {
    const config = this.options.serverSide;
    if (!config?.enabled || !config.fetchRows) {
      return { rows: this.options.rows };
    }
    return config.fetchRows(config.query ?? {});
  }

  saveColumnState(state: GridColumnState[]): void {
    const key = this.options.columnStateKey;
    if (!key) return;
    const storage = this.options.storage ?? resolveStorage();
    if (!storage) return;
    storage.setItem(key, JSON.stringify(state));
  }

  loadColumnState(): GridColumnState[] {
    const key = this.options.columnStateKey;
    if (!key) return [];
    const storage = this.options.storage ?? resolveStorage();
    if (!storage) return [];
    const raw = storage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isColumnState);
    } catch {
      return [];
    }
  }

  exportCsv(rows?: Array<Row | GroupNode<Row>>): string {
    const renderedRows = rows ?? this.prepareView().rows;
    const rowOnly = renderedRows.filter((entry): entry is Row => !isGroupNode<Row>(entry));
    return exportToCsv(rowOnly, this.options.columns.map((column) => ({ key: String(column.key), title: column.title })));
  }

  exportExcel(rows?: Array<Row | GroupNode<Row>>): string {
    const renderedRows = rows ?? this.prepareView().rows;
    const rowOnly = renderedRows.filter((entry): entry is Row => !isGroupNode<Row>(entry));
    return exportToExcelXml(rowOnly, this.options.columns.map((column) => ({ key: String(column.key), title: column.title })));
  }

  private applyColumnState(columns: Array<GridColumn<Row>>): Array<GridColumn<Row>> {
    const state = this.loadColumnState();
    if (state.length === 0) return columns;

    const stateMap = new Map(state.map((entry) => [entry.key, entry]));
    const withState = columns
      .map((column, index) => {
        const existing = stateMap.get(String(column.key));
        if (!existing || existing.hidden) return null;
        return {
          ...column,
          order: existing.order ?? index,
        };
      })
      .filter((column): column is GridColumn<Row> & { order: number } => column !== null)
      .sort((left, right) => left.order - right.order);
    return withState.map(({ order, ...column }) => column);
  }
}

function buildSparklines<Row extends Record<string, unknown>>(
  rows: Array<Row | GroupNode<Row>>,
  columns: Array<GridColumn<Row>>,
): Record<string, Record<string, string>> {
  const sparklineColumns = columns.filter((column) => column.sparkline);
  if (sparklineColumns.length === 0) return {};

  const result: Record<string, Record<string, string>> = {};
  rows.forEach((row, index) => {
    if (isGroupNode<Row>(row)) return;
    const rowKey = String((row as Record<string, unknown>).id ?? index);
    for (const column of sparklineColumns) {
      const value = row[String(column.key)];
      if (!Array.isArray(value)) continue;
      const numeric = value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
      if (numeric.length < 2) continue;
      result[rowKey] = result[rowKey] ?? {};
      result[rowKey][String(column.key)] = buildSparklinePath(numeric, 80, 20);
    }
  });
  return result;
}

export function buildSparklinePath(points: number[], width: number, height: number): string {
  if (points.length === 0) return '';
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  return points
    .map((value, index) => {
      const x = (index / Math.max(1, points.length - 1)) * safeWidth;
      const y = safeHeight - ((value - min) / span) * safeHeight;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function resolveStorage(): ColumnStateStorage | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  const maybeStorage = (globalThis as { localStorage?: ColumnStateStorage }).localStorage;
  return maybeStorage;
}

function isColumnState(value: unknown): value is GridColumnState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.key === 'string';
}
