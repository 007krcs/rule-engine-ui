'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { I18nProvider } from '@platform/i18n';
import type { ExecutionContext, JSONValue, UIComponent, UIGridItem, UISchema } from '@platform/schema';
import { RenderPage } from '@platform/react-renderer';
import { cn } from '@/lib/utils';
import styles from './grid-canvas.module.scss';

export type GridCanvasProps = {
  components: UIComponent[];
  items: UIGridItem[];
  columns: number;
  rowHeight: number;
  gap: number;
  selectedComponentId: string | null;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  i18n: I18nProvider;
  disabled?: boolean;
  showGrid?: boolean;
  onSelect: (componentId: string) => void;
  onRemove: (componentId: string) => void;
  onMove: (componentId: string, x: number, y: number) => void;
  onResize: (componentId: string, w: number, h: number) => void;
  onMetricsChange?: (metrics: {
    cellWidth: number;
    rowHeight: number;
    gap: number;
    canvasRect: DOMRect | null;
  }) => void;
};

type GridItemCardProps = {
  item: UIGridItem;
  component: UIComponent | null;
  selected: boolean;
  disabled: boolean;
  cellWidth: number;
  rowHeight: number;
  gap: number;
  columns: number;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  i18n: I18nProvider;
  onSelect: (componentId: string) => void;
  onRemove: (componentId: string) => void;
  onMove: (componentId: string, x: number, y: number) => void;
  onResize: (componentId: string, w: number, h: number) => void;
};

export function GridCanvas({
  components,
  items,
  columns,
  rowHeight,
  gap,
  selectedComponentId,
  data,
  context,
  i18n,
  disabled = false,
  showGrid = true,
  onSelect,
  onRemove,
  onMove,
  onResize,
  onMetricsChange,
}: GridCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(1200);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setCanvasWidth(Math.max(360, Math.floor(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const componentById = useMemo(
    () => new Map(components.map((component) => [component.id, component])),
    [components],
  );

  const safeColumns = Math.max(1, columns);
  const safeGap = Math.max(1, gap);
  const safeRowHeight = Math.max(20, rowHeight);
  const totalGap = safeGap * Math.max(0, safeColumns - 1);
  const cellWidth = Math.max(48, (canvasWidth - totalGap) / safeColumns);

  const rows = useMemo(
    () => Math.max(6, ...items.map((item) => item.y + item.h + 1)),
    [items],
  );
  const minHeight = rows * safeRowHeight + Math.max(0, rows - 1) * safeGap + 16;

  useEffect(() => {
    onMetricsChange?.({
      cellWidth,
      rowHeight: safeRowHeight,
      gap: safeGap,
      canvasRect: canvasRef.current?.getBoundingClientRect() ?? null,
    });
  }, [cellWidth, onMetricsChange, safeGap, safeRowHeight]);

  const canvasStyle: CSSProperties = {
    minHeight,
    '--builder-grid-col-size': `${cellWidth + safeGap}px`,
    '--builder-grid-row-size': `${safeRowHeight + safeGap}px`,
  } as CSSProperties;

  return (
    <div
      ref={canvasRef}
      className={styles.canvas}
      style={canvasStyle}
      data-grid-visible={showGrid}
      data-testid="builder-grid-canvas"
    >
      {items.length === 0 ? <p className={styles.empty}>Drag from the palette to place a component.</p> : null}
      {items.map((item) => (
        <GridItemCard
          key={item.id}
          item={item}
          component={componentById.get(item.componentId) ?? null}
          selected={selectedComponentId === item.componentId}
          disabled={disabled}
          cellWidth={cellWidth}
          rowHeight={safeRowHeight}
          gap={safeGap}
          columns={safeColumns}
          data={data}
          context={context}
          i18n={i18n}
          onSelect={onSelect}
          onRemove={onRemove}
          onMove={onMove}
          onResize={onResize}
        />
      ))}
    </div>
  );
}

function GridItemCard({
  item,
  component,
  selected,
  disabled,
  cellWidth,
  rowHeight,
  gap,
  columns,
  data,
  context,
  i18n,
  onSelect,
  onRemove,
  onMove,
  onResize,
}: GridItemCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `canvas:${item.componentId}`,
    disabled,
    data: {
      kind: 'item',
      componentId: item.componentId,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    },
  });

  const left = item.x * (cellWidth + gap);
  const top = item.y * (rowHeight + gap);
  const width = item.w * cellWidth + Math.max(0, item.w - 1) * gap;
  const height = item.h * rowHeight + Math.max(0, item.h - 1) * gap;

  const style: CSSProperties = {
    left,
    top,
    width,
    height,
    transform: CSS.Transform.toString(transform),
    zIndex: selected ? 8 : 2,
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onRemove(item.componentId);
      return;
    }

    if (event.shiftKey) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onResize(item.componentId, Math.min(columns - item.x, item.w + 1), item.h);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onResize(item.componentId, Math.max(1, item.w - 1), item.h);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        onResize(item.componentId, item.w, item.h + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        onResize(item.componentId, item.w, Math.max(1, item.h - 1));
      }
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onMove(item.componentId, item.x + 1, item.y);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onMove(item.componentId, item.x - 1, item.y);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMove(item.componentId, item.x, item.y + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMove(item.componentId, item.x, Math.max(0, item.y - 1));
    }
  };

  const startResize = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const stepX = cellWidth + gap;
    const stepY = rowHeight + gap;
    const startWidth = item.w;
    const startHeight = item.h;

    const onMovePointer = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const nextWidth = Math.max(1, Math.min(columns - item.x, startWidth + Math.round(deltaX / stepX)));
      const nextHeight = Math.max(1, startHeight + Math.round(deltaY / stepY));
      onResize(item.componentId, nextWidth, nextHeight);
    };

    const onStop = () => {
      window.removeEventListener('mousemove', onMovePointer);
      window.removeEventListener('mouseup', onStop);
    };

    window.addEventListener('mousemove', onMovePointer);
    window.addEventListener('mouseup', onStop);
  };

  return (
    <div
      ref={setNodeRef}
      className={styles.item}
      style={style}
      data-selected={selected}
      data-testid={`builder-grid-item-${item.componentId}`}
      onClick={() => onSelect(item.componentId)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="group"
      aria-label={`Grid item ${item.componentId} at ${item.x},${item.y}`}
    >
      <div className={styles.itemHeader}>
        <div className={styles.meta}>
          <p className={styles.itemId}>{item.componentId}</p>
          <p className={styles.itemHint}>{component?.adapterHint ?? 'Unknown component'}</p>
        </div>
        <div className={styles.itemActions}>
          <span className={styles.chip}>
            <span data-testid={`builder-grid-item-meta-${item.componentId}`}>
            {item.x},{item.y} {item.w}x{item.h}
            </span>
          </span>
          <button
            type="button"
            className={cn(styles.actionButton, styles.dragHandle)}
            aria-label={`Move ${item.componentId}`}
            {...attributes}
            {...listeners}
          >
            ::
          </button>
          <button
            type="button"
            className={styles.actionButton}
            aria-label={`Remove ${item.componentId}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemove(item.componentId);
            }}
          >
            x
          </button>
        </div>
      </div>
      <div className={styles.itemBody} tabIndex={0} aria-label={`Rendered preview for ${item.componentId}`}>
        {component ? (
          <RenderPage
            uiSchema={toSingleComponentSchema(component)}
            data={data}
            context={context}
            i18n={i18n}
          />
        ) : (
          <p>Component is missing from schema components.</p>
        )}
      </div>
      <button
        type="button"
        className={styles.resizeHandle}
        aria-label={`Resize ${item.componentId}`}
        onMouseDown={startResize}
      />
    </div>
  );
}

function toSingleComponentSchema(component: UIComponent): UISchema {
  return {
    version: '1.0.0',
    pageId: `preview-${component.id}`,
    layoutType: 'grid',
    grid: { columns: 1, rowHeight: 48, gap: 8, collisionStrategy: 'push' },
    items: [
      {
        id: component.id,
        componentId: component.id,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
      },
    ],
    layout: {
      id: 'root',
      type: 'grid',
      columns: 1,
      componentIds: [component.id],
    },
    components: [component],
  };
}
