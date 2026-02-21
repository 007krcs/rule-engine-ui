import type { ChartPoint } from './Chart';
import type { TimelineEntry } from './Timeline';

export function buildDummyRowsFromColumns(columns: Array<{ key: string }>, count = 12): Array<Record<string, unknown>> {
  const total = Math.max(1, count);
  return Array.from({ length: total }, (_, index) => {
    const row: Record<string, unknown> = { id: `dummy-${index + 1}` };
    columns.forEach((column, columnIndex) => {
      const key = String(column.key);
      if (key.toLowerCase().includes('date')) {
        row[key] = `2026-02-${String((index % 28) + 1).padStart(2, '0')}`;
      } else if (key.toLowerCase().includes('status')) {
        row[key] = index % 2 === 0 ? 'Active' : 'Pending';
      } else if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('revenue')) {
        row[key] = Math.round((index + 1) * 137.25);
      } else if (key.toLowerCase().includes('trend') || key.toLowerCase().includes('spark')) {
        row[key] = [index + 2, index + 5, index + 3, index + 7];
      } else {
        row[key] = `Sample ${columnIndex + 1}-${index + 1}`;
      }
    });
    return row;
  });
}

export function buildDummyChartPoints(count = 8): ChartPoint[] {
  const total = Math.max(2, count);
  return Array.from({ length: total }, (_, index) => ({
    x: `P${index + 1}`,
    y: Math.round(20 + Math.sin(index / 1.5) * 12 + index * 3),
  }));
}

export function buildDummyTimelineEntries(count = 10): TimelineEntry[] {
  const total = Math.max(1, count);
  return Array.from({ length: total }, (_, index) => ({
    id: `timeline-dummy-${index + 1}`,
    title: `Workflow Event ${index + 1}`,
    description: index % 2 === 0 ? 'Automated status transition completed.' : 'User-approved checkpoint recorded.',
    timestamp: `2026-02-${String((index % 28) + 1).padStart(2, '0')} 10:${String((index * 7) % 60).padStart(2, '0')}`,
  }));
}
