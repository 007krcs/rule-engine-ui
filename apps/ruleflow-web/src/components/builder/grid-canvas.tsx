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
import type { I18nProvider } from '@platform/i18n';
import type { ExecutionContext, JSONValue, UIComponent, UIGridItem, UISchema } from '@platform/schema';
import { RenderPage } from '@platform/react-renderer';
import { cn } from '@/lib/utils';
import {
  clampGridRect,
  clampNumber,
  clientToLogicalPoint,
  gridRectToPx,
  maxRowsFromArtboard,
  pxRectToGrid,
  withRowStep,
  deriveGridUnitMetrics,
  type GridRect,
  type PxRect,
} from './canvas-coordinates';
import styles from './grid-canvas.module.scss';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type CanvasInteraction = {
  componentId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  mode: 'drag' | 'resize';
  px: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

export type GridCanvasMetrics = {
  cellWidth: number;
  colStep: number;
  rowStep: number;
  rowHeight: number;
  gap: number;
  zoom: number;
  surfaceRect: DOMRect | null;
  viewportRect: DOMRect | null;
};

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
  showRulers?: boolean;
  showGuides?: boolean;
  showMarginGuides?: boolean;
  lockAspectRatio?: boolean;
  artboardWidth?: number;
  artboardHeight?: number;
  zoom?: number;
  snap?: boolean;
  onSelect: (componentId: string) => void;
  onRemove: (componentId: string) => void;
  onUpdateLayout: (componentId: string, next: GridRect) => void;
  onInteractionChange?: (interaction: CanvasInteraction | null) => void;
  onMetricsChange?: (metrics: GridCanvasMetrics) => void;
};

type GridItemCardProps = {
  item: UIGridItem;
  component: UIComponent | null;
  selected: boolean;
  disabled: boolean;
  columns: number;
  maxRows: number;
  gap: number;
  zoom: number;
  snap: boolean;
  lockAspectRatio: boolean;
  showGuides: boolean;
  metrics: ReturnType<typeof withRowStep>;
  getSurfaceRect: () => DOMRect | null;
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  i18n: I18nProvider;
  onSelect: (componentId: string) => void;
  onRemove: (componentId: string) => void;
  onUpdateLayout: (componentId: string, next: GridRect) => void;
  onInteractionChange?: (interaction: CanvasInteraction | null) => void;
  onGuideLinesChange: (guides: { x: number[]; y: number[] } | null) => void;
  layerOrder: number;
};

type PointerMoveMode =
  | {
      kind: 'drag';
      startRect: GridRect;
      startPx: PxRect;
      startPointer: { x: number; y: number };
    }
  | {
      kind: 'resize';
      handle: ResizeDirection;
      startRect: GridRect;
      startPx: PxRect;
      startPointer: { x: number; y: number };
      aspect: number;
    };

const RULER_SIZE = 24;
const FRAME_PADDING = 40;
const MARGIN_GUIDE_PX = 24;
const RULER_TICK_STEP = 50;

const RESIZE_HANDLES: ResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

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
  showRulers = true,
  showGuides = true,
  showMarginGuides = true,
  lockAspectRatio = false,
  artboardWidth = 1440,
  artboardHeight = 900,
  zoom = 100,
  snap = true,
  onSelect,
  onRemove,
  onUpdateLayout,
  onInteractionChange,
  onMetricsChange,
}: GridCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const componentById = useMemo(
    () => new Map(components.map((component) => [component.id, component])),
    [components],
  );

  const safeColumns = Math.max(1, columns);
  const safeGap = Math.max(0, gap);
  const safeRowHeight = Math.max(12, rowHeight);
  const safeWidth = Math.max(375, Math.trunc(artboardWidth));
  const safeHeight = Math.max(500, Math.trunc(artboardHeight));
  const safeZoom = clampNumber(zoom / 100, 0.5, 2);

  const baseMetrics = deriveGridUnitMetrics(safeWidth, safeColumns, safeGap);
  const metrics = withRowStep(baseMetrics, safeRowHeight, safeGap);
  const maxRows = maxRowsFromArtboard(safeHeight, safeRowHeight, safeGap);

  const [guideLines, setGuideLines] = useState<{ x: number[]; y: number[] } | null>(null);

  const getSurfaceRect = () => surfaceRef.current?.getBoundingClientRect() ?? null;

  const scaledWidth = Math.round(safeWidth * safeZoom);
  const scaledHeight = Math.round(safeHeight * safeZoom);
  const rulerOffset = showRulers ? RULER_SIZE : 0;
  const frameWidth = scaledWidth + FRAME_PADDING * 2 + rulerOffset;
  const frameHeight = scaledHeight + FRAME_PADDING * 2 + rulerOffset;
  const artboardLeft = FRAME_PADDING + rulerOffset;
  const artboardTop = FRAME_PADDING;

  const publishMetrics = () => {
    onMetricsChange?.({
      cellWidth: metrics.cellWidth,
      colStep: metrics.colStep,
      rowStep: metrics.rowStep,
      rowHeight: safeRowHeight,
      gap: safeGap,
      zoom: safeZoom,
      surfaceRect: getSurfaceRect(),
      viewportRect: viewportRef.current?.getBoundingClientRect() ?? null,
    });
  };

  useEffect(() => {
    publishMetrics();
    const viewportNode = viewportRef.current;
    const surfaceNode = surfaceRef.current;
    if (!viewportNode || !surfaceNode) return;

    const observer = new ResizeObserver(() => publishMetrics());
    observer.observe(viewportNode);
    observer.observe(surfaceNode);
    window.addEventListener('resize', publishMetrics);
    window.addEventListener('scroll', publishMetrics, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publishMetrics);
      window.removeEventListener('scroll', publishMetrics, true);
    };
  }, [metrics.cellWidth, metrics.colStep, metrics.rowStep, safeGap, safeRowHeight, safeZoom]);

  const layeredItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aLayer = typeof a.layer === 'number' ? a.layer : 0;
      const bLayer = typeof b.layer === 'number' ? b.layer : 0;
      if (aLayer !== bLayer) return aLayer - bLayer;
      if (a.y !== b.y) return a.y - b.y;
      if (a.x !== b.x) return a.x - b.x;
      return a.componentId.localeCompare(b.componentId);
    });
  }, [items]);

  const xTicks = useMemo(() => {
    const count = Math.floor(safeWidth / RULER_TICK_STEP) + 1;
    return Array.from({ length: count }, (_, index) => index * RULER_TICK_STEP);
  }, [safeWidth]);

  const yTicks = useMemo(() => {
    const count = Math.floor(safeHeight / RULER_TICK_STEP) + 1;
    return Array.from({ length: count }, (_, index) => index * RULER_TICK_STEP);
  }, [safeHeight]);

  return (
    <div className={styles.viewport} ref={viewportRef} data-testid="builder-canvas-scrollable">
      <div
        className={styles.frame}
        style={
          {
            width: `${frameWidth}px`,
            height: `${frameHeight}px`,
            '--builder-grid-col-size': `${metrics.colStep}px`,
            '--builder-grid-row-size': `${metrics.rowStep}px`,
          } as CSSProperties
        }
      >
        {showRulers ? (
          <>
            <div
              className={styles.rulerTop}
              style={{ left: `${artboardLeft}px`, top: '0px', width: `${scaledWidth}px` }}
            >
              {xTicks.map((tick) => (
                <span
                  key={`x-${tick}`}
                  className={styles.rulerTick}
                  style={{ left: `${tick * safeZoom}px` }}
                >
                  {tick % 100 === 0 ? <em>{tick}</em> : null}
                </span>
              ))}
            </div>
            <div
              className={styles.rulerLeft}
              style={{ left: '0px', top: `${artboardTop}px`, height: `${scaledHeight}px` }}
            >
              {yTicks.map((tick) => (
                <span
                  key={`y-${tick}`}
                  className={styles.rulerTick}
                  style={{ top: `${tick * safeZoom}px` }}
                >
                  {tick % 100 === 0 ? <em>{tick}</em> : null}
                </span>
              ))}
            </div>
          </>
        ) : null}

        <div
          className={styles.artboardShell}
          style={{
            left: `${artboardLeft}px`,
            top: `${artboardTop}px`,
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
          }}
        >
          <div
            className={styles.scaleWrapper}
            style={{
              width: `${safeWidth}px`,
              height: `${safeHeight}px`,
              transform: `scale(${safeZoom})`,
              transformOrigin: 'top left',
            }}
          >
            <div
              ref={surfaceRef}
              className={styles.surface}
              style={{
                width: `${safeWidth}px`,
                height: `${safeHeight}px`,
              }}
              data-grid-visible={showGrid}
              data-testid="builder-grid-canvas"
            >
              {showMarginGuides ? (
                <>
                  <div className={cn(styles.marginGuide, styles.marginGuideLeft)} style={{ left: `${MARGIN_GUIDE_PX}px` }} />
                  <div className={cn(styles.marginGuide, styles.marginGuideRight)} style={{ right: `${MARGIN_GUIDE_PX}px` }} />
                </>
              ) : null}

              {showGuides && guideLines ? (
                <div className={styles.guidesLayer} aria-hidden="true">
                  {guideLines.x.map((x) => (
                    <span key={`gx-${x}`} className={styles.guideVertical} style={{ left: `${x}px` }} />
                  ))}
                  {guideLines.y.map((y) => (
                    <span key={`gy-${y}`} className={styles.guideHorizontal} style={{ top: `${y}px` }} />
                  ))}
                </div>
              ) : null}

              {layeredItems.length === 0 ? (
                <p className={styles.empty}>Drag from the palette to place a component.</p>
              ) : null}

              {layeredItems.map((item, index) => (
                <GridItemCard
                  key={item.id}
                  item={item}
                  component={componentById.get(item.componentId) ?? null}
                  selected={selectedComponentId === item.componentId}
                  disabled={disabled}
                  columns={safeColumns}
                  maxRows={maxRows}
                  gap={safeGap}
                  zoom={safeZoom}
                  snap={snap}
                  lockAspectRatio={lockAspectRatio}
                  showGuides={showGuides}
                  metrics={metrics}
                  getSurfaceRect={getSurfaceRect}
                  data={data}
                  context={context}
                  i18n={i18n}
                  onSelect={onSelect}
                  onRemove={onRemove}
                  onUpdateLayout={onUpdateLayout}
                  onInteractionChange={onInteractionChange}
                  onGuideLinesChange={setGuideLines}
                  layerOrder={typeof item.layer === 'number' ? item.layer : index}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GridItemCard({
  item,
  component,
  selected,
  disabled,
  columns,
  maxRows,
  gap,
  zoom,
  snap,
  lockAspectRatio,
  showGuides,
  metrics,
  getSurfaceRect,
  data,
  context,
  i18n,
  onSelect,
  onRemove,
  onUpdateLayout,
  onInteractionChange,
  onGuideLinesChange,
  layerOrder,
}: GridItemCardProps) {
  const interactionRef = useRef<PointerMoveMode | null>(null);
  const lastRectRef = useRef<GridRect>({ x: item.x, y: item.y, w: item.w, h: item.h });

  const currentRect = clampGridRect(
    { x: item.x, y: item.y, w: item.w, h: item.h },
    columns,
    maxRows,
  );
  const currentPx = gridRectToPx(currentRect, metrics, gap);

  const style: CSSProperties = {
    left: `${currentPx.left}px`,
    top: `${currentPx.top}px`,
    width: `${currentPx.width}px`,
    height: `${currentPx.height}px`,
    zIndex: selected ? 1000 : 10 + Math.max(0, layerOrder),
  };

  useEffect(() => {
    lastRectRef.current = currentRect;
  }, [currentRect.h, currentRect.w, currentRect.x, currentRect.y]);

  const emitInteraction = (nextRect: GridRect, mode: 'drag' | 'resize') => {
    const nextPx = gridRectToPx(nextRect, metrics, gap);
    onInteractionChange?.({
      componentId: item.componentId,
      x: nextRect.x,
      y: nextRect.y,
      w: nextRect.w,
      h: nextRect.h,
      mode,
      px: nextPx,
    });
  };

  const setGuides = (nextRect: GridRect) => {
    if (!showGuides) return;
    const px = gridRectToPx(nextRect, metrics, gap);
    onGuideLinesChange({
      x: [px.left, px.left + px.width],
      y: [px.top, px.top + px.height],
    });
  };

  const stopPointerInteraction = () => {
    interactionRef.current = null;
    onGuideLinesChange(null);
    onInteractionChange?.(null);
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', stopPointerInteraction);
  };

  const applyNextRect = (nextRectRaw: GridRect, mode: 'drag' | 'resize') => {
    const nextRect = clampGridRect(nextRectRaw, columns, maxRows);
    const previous = lastRectRef.current;
    if (
      previous.x === nextRect.x &&
      previous.y === nextRect.y &&
      previous.w === nextRect.w &&
      previous.h === nextRect.h
    ) {
      emitInteraction(nextRect, mode);
      setGuides(nextRect);
      return;
    }
    lastRectRef.current = nextRect;
    onUpdateLayout(item.componentId, nextRect);
    emitInteraction(nextRect, mode);
    setGuides(nextRect);
  };

  const onPointerMove = (event: MouseEvent) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const surfaceRect = getSurfaceRect();
    if (!surfaceRect) return;

    const logical = clientToLogicalPoint(event.clientX, event.clientY, surfaceRect, zoom);
    const deltaX = logical.x - interaction.startPointer.x;
    const deltaY = logical.y - interaction.startPointer.y;

    if (interaction.kind === 'drag') {
      const nextPxRect: PxRect = {
        ...interaction.startPx,
        left: clampNumber(interaction.startPx.left + deltaX, 0, Math.max(0, surfaceRect.width / zoom - interaction.startPx.width)),
        top: clampNumber(interaction.startPx.top + deltaY, 0, Math.max(0, surfaceRect.height / zoom - interaction.startPx.height)),
      };
      const nextGridRect = clampGridRect(pxRectToGrid(nextPxRect, metrics, gap, snap), columns, maxRows);
      applyNextRect(
        {
          ...interaction.startRect,
          x: nextGridRect.x,
          y: nextGridRect.y,
        },
        'drag',
      );
      return;
    }

    const minWidth = Math.max(12, metrics.colStep - gap);
    const minHeight = Math.max(12, metrics.rowStep - gap);
    const artboardWidth = Math.max(320, surfaceRect.width / zoom);
    const artboardHeight = Math.max(320, surfaceRect.height / zoom);
    let left = interaction.startPx.left;
    let top = interaction.startPx.top;
    let right = interaction.startPx.left + interaction.startPx.width;
    let bottom = interaction.startPx.top + interaction.startPx.height;

    if (interaction.handle.includes('e')) {
      right += deltaX;
    }
    if (interaction.handle.includes('w')) {
      left += deltaX;
    }
    if (interaction.handle.includes('s')) {
      bottom += deltaY;
    }
    if (interaction.handle.includes('n')) {
      top += deltaY;
    }

    if (lockAspectRatio && interaction.handle.length === 2) {
      const rawWidth = Math.max(minWidth, right - left);
      const rawHeight = Math.max(minHeight, bottom - top);
      let width = rawWidth;
      let height = rawHeight;
      if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        height = Math.max(minHeight, width / interaction.aspect);
      } else {
        width = Math.max(minWidth, height * interaction.aspect);
      }
      if (interaction.handle.includes('w')) {
        left = right - width;
      } else {
        right = left + width;
      }
      if (interaction.handle.includes('n')) {
        top = bottom - height;
      } else {
        bottom = top + height;
      }
    }

    left = clampNumber(left, 0, artboardWidth - minWidth);
    top = clampNumber(top, 0, artboardHeight - minHeight);
    right = clampNumber(right, left + minWidth, artboardWidth);
    bottom = clampNumber(bottom, top + minHeight, artboardHeight);

    const nextPxRect: PxRect = {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
    const nextGridRect = clampGridRect(pxRectToGrid(nextPxRect, metrics, gap, snap), columns, maxRows);
    applyNextRect(nextGridRect, 'resize');
  };

  const startDrag = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const surfaceRect = getSurfaceRect();
    if (!surfaceRect) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(item.componentId);
    const startPointer = clientToLogicalPoint(event.clientX, event.clientY, surfaceRect, zoom);
    interactionRef.current = {
      kind: 'drag',
      startRect: currentRect,
      startPx: currentPx,
      startPointer,
    };
    emitInteraction(currentRect, 'drag');
    setGuides(currentRect);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', stopPointerInteraction);
  };

  const startResize = (direction: ResizeDirection) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const surfaceRect = getSurfaceRect();
    if (!surfaceRect) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(item.componentId);
    const startPointer = clientToLogicalPoint(event.clientX, event.clientY, surfaceRect, zoom);
    interactionRef.current = {
      kind: 'resize',
      handle: direction,
      startRect: currentRect,
      startPx: currentPx,
      startPointer,
      aspect: Math.max(0.1, currentPx.width / Math.max(1, currentPx.height)),
    };
    emitInteraction(currentRect, 'resize');
    setGuides(currentRect);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', stopPointerInteraction);
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
        applyNextRect({ ...currentRect, w: currentRect.w + 1 }, 'resize');
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        applyNextRect({ ...currentRect, w: currentRect.w - 1 }, 'resize');
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        applyNextRect({ ...currentRect, h: currentRect.h + 1 }, 'resize');
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        applyNextRect({ ...currentRect, h: currentRect.h - 1 }, 'resize');
        return;
      }
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      applyNextRect({ ...currentRect, x: currentRect.x + 1 }, 'drag');
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      applyNextRect({ ...currentRect, x: currentRect.x - 1 }, 'drag');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      applyNextRect({ ...currentRect, y: currentRect.y + 1 }, 'drag');
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      applyNextRect({ ...currentRect, y: currentRect.y - 1 }, 'drag');
    }
  };

  return (
    <div
      className={styles.item}
      style={style}
      data-selected={selected}
      data-testid={`builder-grid-item-${item.componentId}`}
      onClick={() => onSelect(item.componentId)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="group"
      aria-label={`Grid item ${item.componentId} at ${currentRect.x},${currentRect.y}`}
    >
      <div className={styles.itemHeader}>
        <div className={styles.meta}>
          <p className={styles.itemId}>{item.componentId}</p>
          <p className={styles.itemHint}>{component?.adapterHint ?? 'Unknown component'}</p>
        </div>
        <div className={styles.itemActions}>
          <span className={styles.chip}>
            <span data-testid={`builder-grid-item-meta-${item.componentId}`}>
              {currentRect.x},{currentRect.y} {currentRect.w}x{currentRect.h}
            </span>
          </span>
          <button
            type="button"
            className={cn(styles.actionButton, styles.dragHandle)}
            aria-label={`Move ${item.componentId}`}
            data-testid={`builder-drag-${item.componentId}`}
            onMouseDown={startDrag}
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

      <div className={styles.measureOverlay}>
        {Math.round(currentPx.left)}px, {Math.round(currentPx.top)}px - {Math.round(currentPx.width)}x{Math.round(currentPx.height)}px
      </div>

      {RESIZE_HANDLES.map((handle) => (
        <button
          key={handle}
          type="button"
          className={cn(styles.resizeHandle, styles[`resizeHandle${handle.toUpperCase()}` as keyof typeof styles])}
          aria-label={`Resize ${item.componentId} ${handle}`}
          data-testid={`builder-resize-${item.componentId}-${handle}`}
          onMouseDown={startResize(handle)}
        />
      ))}
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
