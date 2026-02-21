import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Table } from '../src/Table';
import { Timeline } from '../src/Timeline';

describe('virtualization engine', () => {
  it('handles 50k rows with windowed rendering', () => {
    const rows = Array.from({ length: 50000 }, (_, index) => ({
      id: `row-${index}`,
      name: `Row ${index}`,
      value: index,
    }));
    const columns = [
      { key: 'id', title: 'ID' },
      { key: 'name', title: 'Name' },
      { key: 'value', title: 'Value' },
    ];

    const { getByTestId, getAllByTestId, queryByText } = render(
      <Table
        columns={columns}
        data={rows}
        height={360}
        estimateRowHeight={36}
        retentionKey="stress-50k"
      />,
    );

    const list = getByTestId('virtual-list');
    expect(getAllByTestId('table-row').length).toBeLessThan(80);
    expect(queryByText('Row 25000')).toBeNull();

    Object.defineProperty(list, 'scrollTop', { value: 900000, writable: true });
    fireEvent.scroll(list);

    expect(getAllByTestId('table-row').length).toBeLessThan(80);
  });

  it('requests next cursor page near end of timeline', () => {
    const onRequestNextPage = vi.fn();
    const items = Array.from({ length: 200 }, (_, index) => ({
      id: `event-${index}`,
      title: `Event ${index}`,
    }));

    const { getByTestId } = render(
      <Timeline
        items={items}
        height={260}
        retentionKey="timeline-1"
        hasNextPage
        nextCursor="cursor-2"
        onRequestNextPage={onRequestNextPage}
      />,
    );

    const list = getByTestId('virtual-list');
    Object.defineProperty(list, 'scrollTop', { value: 20000, writable: true });
    fireEvent.scroll(list);

    expect(onRequestNextPage).toHaveBeenCalledWith('cursor-2');
  });
});
