import { describe, expect, it, vi } from 'vitest';
import { aggregateRows } from '../src/AggregationEngine';
import { exportToCsv, exportToExcelXml } from '../src/ExportEngine';
import { GridCore } from '../src/GridCore';
import { groupRows } from '../src/GroupingEngine';
import { pivotRows } from '../src/PivotEngine';

describe('data-grid engines', () => {
  const rows = [
    { id: '1', region: 'NA', quarter: 'Q1', revenue: 10, spark: [1, 2, 3] },
    { id: '2', region: 'NA', quarter: 'Q2', revenue: 20, spark: [2, 4, 3] },
    { id: '3', region: 'EU', quarter: 'Q1', revenue: 8, spark: [3, 3, 4] },
  ];

  it('aggregates rows', () => {
    const result = aggregateRows(rows, { revenue: 'sum' });
    expect(result.revenue).toBe(38);
  });

  it('groups rows', () => {
    const groups = groupRows(rows, { keys: ['region'] });
    expect(groups.length).toBe(2);
    expect(groups[0]?.rows.length).toBeGreaterThan(0);
  });

  it('pivots rows', () => {
    const result = pivotRows(rows, {
      rowKey: 'region',
      pivotKey: 'quarter',
      valueKey: 'revenue',
      aggregation: 'sum',
    });
    expect(result.columns).toContain('Q1');
    const na = result.rows.find((row) => row.region === 'NA');
    expect(na?.Q2).toBe(20);
  });

  it('exports csv and excel xml', () => {
    const csv = exportToCsv(rows, [
      { key: 'region', title: 'Region' },
      { key: 'revenue', title: 'Revenue' },
    ]);
    expect(csv).toContain('Region,Revenue');
    const xml = exportToExcelXml(rows, [{ key: 'region', title: 'Region' }]);
    expect(xml).toContain('<Workbook');
  });

  it('supports GridCore server mode + column state persistence', async () => {
    const storage = new Map<string, string>();
    const core = new GridCore({
      rows,
      columns: [
        { key: 'region', title: 'Region', groupable: true },
        { key: 'revenue', title: 'Revenue', aggregatable: true },
        { key: 'spark', title: 'Trend', sparkline: true },
      ],
      grouping: { enabled: true, keys: ['region'] },
      aggregation: { enabled: true, config: { revenue: 'sum' } },
      columnStateKey: 'dg-state',
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
      serverSide: {
        enabled: true,
        query: { pageSize: 50 },
        fetchRows: vi.fn(async () => ({ rows, total: rows.length, cursor: null })),
      },
    });

    core.saveColumnState([{ key: 'region', order: 1 }, { key: 'revenue', order: 0 }, { key: 'spark', order: 2 }]);
    const state = core.loadColumnState();
    expect(state.length).toBe(3);

    const fetched = await core.fetchServerRows();
    expect(fetched.total).toBe(rows.length);

    const view = core.prepareView();
    expect(view.groupedRows.length).toBe(2);
    expect(Object.keys(view.sparklineByRowId).length).toBeGreaterThan(0);
  });
});
