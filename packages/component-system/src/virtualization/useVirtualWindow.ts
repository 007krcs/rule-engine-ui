import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface VirtualWindowOptions {
  itemCount: number;
  viewportHeight: number;
  estimateItemHeight?: number;
  overscan?: number;
  retentionKey?: string;
  hasNextPage?: boolean;
  nextCursor?: string | null;
  onRequestNextPage?: (cursor: string | null) => void;
}

export interface VirtualWindowResult {
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  getOffsetTop: (index: number) => number;
  getItemHeight: (index: number) => number;
  measureItem: (index: number, height: number) => void;
  onScroll: (scrollTop: number) => void;
  scrollTop: number;
  visibleCount: number;
}

const SCROLL_RETENTION = new Map<string, number>();

export function useVirtualWindow(options: VirtualWindowOptions): VirtualWindowResult {
  const estimateItemHeight = Math.max(1, Math.trunc(options.estimateItemHeight ?? 44));
  const overscan = Math.max(0, Math.trunc(options.overscan ?? 6));
  const viewportHeight = Math.max(1, Math.trunc(options.viewportHeight));
  const [scrollTop, setScrollTop] = useState(() => {
    if (!options.retentionKey) return 0;
    return SCROLL_RETENTION.get(options.retentionKey) ?? 0;
  });
  const heightsRef = useRef(new Map<number, number>());
  const pageRequestedRef = useRef<string | null>(null);

  const getItemHeight = useCallback(
    (index: number) => heightsRef.current.get(index) ?? estimateItemHeight,
    [estimateItemHeight],
  );

  const getOffsetTop = useCallback(
    (index: number) => {
      let top = 0;
      for (let i = 0; i < index; i += 1) {
        top += getItemHeight(i);
      }
      return top;
    },
    [getItemHeight],
  );

  const totalHeight = useMemo(() => {
    let total = 0;
    for (let i = 0; i < options.itemCount; i += 1) {
      total += getItemHeight(i);
    }
    return total;
  }, [getItemHeight, options.itemCount]);

  const visibleCount = Math.max(1, Math.ceil(viewportHeight / estimateItemHeight));
  const roughStart = Math.floor(scrollTop / estimateItemHeight);
  const startIndex = clamp(roughStart - overscan, 0, Math.max(0, options.itemCount - 1));
  const endIndex = clamp(
    roughStart + visibleCount + overscan,
    startIndex,
    Math.max(startIndex, options.itemCount - 1),
  );

  const measureItem = useCallback((index: number, height: number) => {
    if (!Number.isFinite(height) || height <= 0) return;
    const rounded = Math.max(1, Math.round(height));
    if (heightsRef.current.get(index) === rounded) return;
    heightsRef.current.set(index, rounded);
  }, []);

  const onScroll = useCallback(
    (nextScrollTop: number) => {
      const normalized = Math.max(0, Math.floor(nextScrollTop));
      setScrollTop(normalized);
      if (options.retentionKey) {
        SCROLL_RETENTION.set(options.retentionKey, normalized);
      }
    },
    [options.retentionKey],
  );

  useEffect(() => {
    if (!options.hasNextPage || !options.onRequestNextPage) return;
    const nearEnd = endIndex >= Math.max(0, options.itemCount - 5);
    if (!nearEnd) return;
    const cursor = options.nextCursor ?? null;
    if (pageRequestedRef.current === cursor) return;
    pageRequestedRef.current = cursor;
    options.onRequestNextPage(cursor);
  }, [
    endIndex,
    options.hasNextPage,
    options.itemCount,
    options.nextCursor,
    options.onRequestNextPage,
  ]);

  return {
    startIndex,
    endIndex,
    totalHeight,
    getOffsetTop,
    getItemHeight,
    measureItem,
    onScroll,
    scrollTop,
    visibleCount,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
