import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { VirtualList } from './VirtualList';

export interface VirtualGridProps<T> {
  items: T[];
  height: number;
  columnCount: number;
  estimateRowHeight?: number;
  overscan?: number;
  retentionKey?: string;
  hasNextPage?: boolean;
  nextCursor?: string | null;
  onRequestNextPage?: (cursor: string | null) => void;
  getItemKey?: (item: T, index: number) => string;
  renderCell: (item: T, index: number) => ReactNode;
  className?: string;
}

export function VirtualGrid<T>({
  items,
  height,
  columnCount,
  estimateRowHeight = 52,
  overscan = 4,
  retentionKey,
  hasNextPage,
  nextCursor,
  onRequestNextPage,
  getItemKey,
  renderCell,
  className,
}: VirtualGridProps<T>) {
  const safeColumns = Math.max(1, Math.floor(columnCount));
  const rows = useMemo(() => chunk(items, safeColumns), [items, safeColumns]);

  return (
    <VirtualList
      items={rows}
      height={height}
      estimateItemHeight={estimateRowHeight}
      overscan={overscan}
      retentionKey={retentionKey}
      hasNextPage={hasNextPage}
      nextCursor={nextCursor}
      onRequestNextPage={onRequestNextPage}
      className={className}
      renderItem={(row, rowIndex) => {
        const rowStyle: CSSProperties = {
          display: 'grid',
          gridTemplateColumns: `repeat(${safeColumns}, minmax(0, 1fr))`,
          alignItems: 'stretch',
        };
        return (
          <div style={rowStyle} role="row">
            {row.map((cell, cellIndex) => {
              const index = rowIndex * safeColumns + cellIndex;
              const key = getItemKey?.(cell, index) ?? `cell-${index}`;
              return (
                <div key={key} role="gridcell">
                  {renderCell(cell, index)}
                </div>
              );
            })}
          </div>
        );
      }}
    />
  );
}

function chunk<T>(items: T[], chunkSize: number): T[][] {
  if (items.length === 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    result.push(items.slice(i, i + chunkSize));
  }
  return result;
}
