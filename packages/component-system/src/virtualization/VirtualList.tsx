import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { useVirtualWindow } from './useVirtualWindow';

export interface VirtualListProps<T> {
  items: T[];
  height: number;
  estimateItemHeight?: number;
  overscan?: number;
  className?: string;
  listClassName?: string;
  retentionKey?: string;
  hasNextPage?: boolean;
  nextCursor?: string | null;
  onRequestNextPage?: (cursor: string | null) => void;
  getItemKey?: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
}

export function VirtualList<T>({
  items,
  height,
  estimateItemHeight = 44,
  overscan = 6,
  className,
  listClassName,
  retentionKey,
  hasNextPage,
  nextCursor,
  onRequestNextPage,
  getItemKey,
  renderItem,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const windowState = useVirtualWindow({
    itemCount: items.length,
    viewportHeight: height,
    estimateItemHeight,
    overscan,
    retentionKey,
    hasNextPage,
    nextCursor,
    onRequestNextPage,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollTop !== windowState.scrollTop) {
      container.scrollTop = windowState.scrollTop;
    }
  }, [windowState.scrollTop]);

  const slots = useMemo(() => {
    if (items.length === 0) return [];
    const start = windowState.startIndex;
    const end = windowState.endIndex;
    const count = Math.max(0, end - start + 1);
    const next: Array<{ slotIndex: number; itemIndex: number; item: T }> = [];
    for (let slotIndex = 0; slotIndex < count; slotIndex += 1) {
      const itemIndex = start + slotIndex;
      const item = items[itemIndex];
      if (item === undefined) continue;
      next.push({
        slotIndex,
        itemIndex,
        item,
      });
    }
    return next;
  }, [items, windowState.endIndex, windowState.startIndex]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, overflow: 'auto' }}
      onScroll={(event) => windowState.onScroll(event.currentTarget.scrollTop)}
      data-testid="virtual-list"
    >
      <div className={listClassName} style={{ height: windowState.totalHeight, position: 'relative' }}>
        {slots.map((slot) => {
          const style: CSSProperties = {
            position: 'absolute',
            top: windowState.getOffsetTop(slot.itemIndex),
            left: 0,
            right: 0,
            minHeight: windowState.getItemHeight(slot.itemIndex),
          };
          const stableKey = getItemKey?.(slot.item, slot.itemIndex) ?? `slot-${slot.slotIndex}`;
          return (
            <VirtualSlot
              key={`slot-${slot.slotIndex}`}
              style={style}
              onMeasure={(size) => windowState.measureItem(slot.itemIndex, size)}
              dataKey={stableKey}
            >
              {renderItem(slot.item, slot.itemIndex)}
            </VirtualSlot>
          );
        })}
      </div>
    </div>
  );
}

function VirtualSlot({
  style,
  onMeasure,
  children,
  dataKey,
}: {
  style: CSSProperties;
  onMeasure: (height: number) => void;
  children: ReactNode;
  dataKey: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    onMeasure(node.getBoundingClientRect().height);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onMeasure(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [dataKey, onMeasure]);

  return (
    <div ref={ref} style={style} data-key={dataKey}>
      {children}
    </div>
  );
}
