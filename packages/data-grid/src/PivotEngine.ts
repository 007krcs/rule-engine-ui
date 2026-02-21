import { aggregateValues, type AggregationType } from './AggregationEngine';

export interface PivotConfig {
  rowKey: string;
  pivotKey: string;
  valueKey: string;
  aggregation?: AggregationType;
}

export interface PivotResult {
  columns: string[];
  rows: Array<Record<string, string | number>>;
}

export function pivotRows<T extends Record<string, unknown>>(rows: T[], config: PivotConfig): PivotResult {
  const rowKey = config.rowKey;
  const pivotKey = config.pivotKey;
  const valueKey = config.valueKey;
  const aggregation = config.aggregation ?? 'sum';

  const pivotColumns = new Set<string>();
  const rowBuckets = new Map<string, Map<string, number[]>>();

  for (const row of rows) {
    const rowValue = row[rowKey] == null ? '(empty)' : String(row[rowKey]);
    const pivotValue = row[pivotKey] == null ? '(empty)' : String(row[pivotKey]);
    const numericValue = row[valueKey];
    if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) continue;

    pivotColumns.add(pivotValue);
    const pivotBucket = rowBuckets.get(rowValue) ?? new Map<string, number[]>();
    const values = pivotBucket.get(pivotValue) ?? [];
    values.push(numericValue);
    pivotBucket.set(pivotValue, values);
    rowBuckets.set(rowValue, pivotBucket);
  }

  const columns = [rowKey, ...Array.from(pivotColumns.values())];
  const outputRows: Array<Record<string, string | number>> = [];
  for (const [rowValue, pivotBucket] of rowBuckets.entries()) {
    const output: Record<string, string | number> = { [rowKey]: rowValue };
    for (const column of columns.slice(1)) {
      const values = pivotBucket.get(column) ?? [];
      output[column] = aggregateValues(values, aggregation);
    }
    outputRows.push(output);
  }

  return { columns, rows: outputRows };
}
