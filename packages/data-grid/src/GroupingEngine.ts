import { aggregateRows, type AggregationConfig, type AggregationResult } from './AggregationEngine';

export interface GroupNode<T> {
  id: string;
  key: string;
  value: string;
  depth: number;
  rows: T[];
  children: GroupNode<T>[];
  aggregates?: AggregationResult;
}

export interface GroupingOptions {
  keys: string[];
  aggregation?: AggregationConfig;
}

export function groupRows<T extends Record<string, unknown>>(
  rows: T[],
  options: GroupingOptions,
): GroupNode<T>[] {
  const keys = options.keys.filter(Boolean);
  if (keys.length === 0) return [];
  return groupRecursive(rows, keys, 0, options.aggregation);
}

function groupRecursive<T extends Record<string, unknown>>(
  rows: T[],
  keys: string[],
  depth: number,
  aggregation: AggregationConfig | undefined,
): GroupNode<T>[] {
  const key = keys[depth];
  if (!key) return [];

  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const raw = row[key];
    const value = raw == null ? '(empty)' : String(raw);
    const bucket = buckets.get(value);
    if (bucket) {
      bucket.push(row);
    } else {
      buckets.set(value, [row]);
    }
  }

  const nodes: GroupNode<T>[] = [];
  for (const [value, groupedRows] of buckets.entries()) {
    const children =
      depth < keys.length - 1 ? groupRecursive(groupedRows, keys, depth + 1, aggregation) : [];
    nodes.push({
      id: `${key}:${value}:${depth}`,
      key,
      value,
      depth,
      rows: groupedRows,
      children,
      aggregates: aggregation ? aggregateRows(groupedRows, aggregation) : undefined,
    });
  }
  return nodes;
}

export function flattenGroups<T extends Record<string, unknown>>(groups: GroupNode<T>[]): Array<GroupNode<T> | T> {
  const out: Array<GroupNode<T> | T> = [];
  for (const group of groups) {
    out.push(group);
    if (group.children.length > 0) {
      out.push(...flattenGroups(group.children));
      continue;
    }
    out.push(...group.rows);
  }
  return out;
}

export function isGroupNode<T extends Record<string, unknown>>(value: unknown): value is GroupNode<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.rows) && Array.isArray(record.children) && typeof record.depth === 'number';
}
