import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataGrid } from '../src/DataGrid';

describe('advanced data-grid', () => {
  it('renders grouping and aggregation summary with virtualization', () => {
    const rows = Array.from({ length: 2000 }, (_, index) => ({
      id: `r-${index}`,
      region: index % 2 === 0 ? 'NA' : 'EU',
      revenue: index + 1,
      trend: [index, index + 1, index + 2],
    }));

    const { getByText, getByRole, queryByText } = render(
      <DataGrid
        columns={[
          { key: 'region', title: 'Region' },
          { key: 'revenue', title: 'Revenue' },
          { key: 'trend', title: 'Trend', sparkline: true },
        ]}
        rows={rows}
        grouping={{ enabled: true, keys: ['region'] }}
        aggregation={{ enabled: true, config: { revenue: 'sum' } }}
        height={280}
        retentionKey="grid-adv-1"
      />,
    );

    expect(getByRole('grid')).toBeTruthy();
    expect(getByText('region: NA')).toBeTruthy();
    expect(queryByText('r-1999')).toBeNull();
  });

  it('supports server-side mode and pivot toggle', async () => {
    const fetchRows = vi.fn(async () => ({
      rows: [
        { id: '1', region: 'NA', quarter: 'Q1', revenue: 10 },
        { id: '2', region: 'NA', quarter: 'Q2', revenue: 20 },
        { id: '3', region: 'EU', quarter: 'Q1', revenue: 5 },
      ],
      total: 3,
    }));

    const { getByText } = render(
      <DataGrid
        columns={[
          { key: 'region', title: 'Region' },
          { key: 'Q1', title: 'Q1' },
          { key: 'Q2', title: 'Q2' },
        ]}
        rows={[]}
        pivot={{ enabled: true, rowKey: 'region', pivotKey: 'quarter', valueKey: 'revenue', aggregation: 'sum' }}
        serverSide={{ enabled: true, fetchRows }}
        height={220}
      />,
    );

    await waitFor(() => {
      expect(fetchRows).toHaveBeenCalled();
      expect(getByText('NA')).toBeTruthy();
      expect(getByText('20')).toBeTruthy();
    });
  });
});
