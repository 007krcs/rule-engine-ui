export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';

export type AggregationConfig = Record<string, AggregationType>;

export type AggregationResult = Record<string, number>;

export function aggregateRows<T extends Record<string, unknown>>(
  rows: T[],
  config: AggregationConfig,
): AggregationResult {
  const result: AggregationResult = {};
  const entries = Object.entries(config);
  for (const [columnKey, aggregation] of entries) {
    const values = rows
      .map((row) => row[columnKey])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    result[columnKey] = aggregateValues(values, aggregation);
  }
  return result;
}

export function aggregateValues(values: number[], aggregation: AggregationType): number {
  if (aggregation === 'count') return values.length;
  if (values.length === 0) return 0;
  if (aggregation === 'sum') return values.reduce((sum, value) => sum + value, 0);
  if (aggregation === 'avg') return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregation === 'min') return Math.min(...values);
  return Math.max(...values);
}
