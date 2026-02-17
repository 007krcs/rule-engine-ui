export type GridUnitMetrics = {
  cellWidth: number;
  colStep: number;
  rowStep: number;
};

export type GridRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PxRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type LogicalPoint = {
  x: number;
  y: number;
};

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function deriveGridUnitMetrics(artboardWidth: number, columns: number, gap: number): GridUnitMetrics {
  const safeColumns = Math.max(1, Math.trunc(columns));
  const safeGap = Math.max(0, gap);
  const totalGap = safeGap * Math.max(0, safeColumns - 1);
  const safeWidth = Math.max(320, artboardWidth);
  const cellWidth = Math.max(24, (safeWidth - totalGap) / safeColumns);
  return {
    cellWidth,
    colStep: cellWidth + safeGap,
    rowStep: 0,
  };
}

export function withRowStep(metrics: GridUnitMetrics, rowHeight: number, gap: number): GridUnitMetrics {
  return {
    ...metrics,
    rowStep: Math.max(12, rowHeight) + Math.max(0, gap),
  };
}

export function gridRectToPx(rect: GridRect, metrics: GridUnitMetrics, gap: number): PxRect {
  const safeGap = Math.max(0, gap);
  const left = rect.x * metrics.colStep;
  const top = rect.y * metrics.rowStep;
  const width = rect.w * metrics.colStep - safeGap;
  const height = rect.h * metrics.rowStep - safeGap;
  return { left, top, width, height };
}

export function pxRectToGrid(rect: PxRect, metrics: GridUnitMetrics, gap: number, snap: boolean): GridRect {
  const safeGap = Math.max(0, gap);
  const toUnit = (value: number, step: number) => {
    if (!Number.isFinite(value)) return 0;
    if (snap) return Math.round(value / step);
    return Math.trunc(value / step);
  };
  const x = Math.max(0, toUnit(rect.left, metrics.colStep));
  const y = Math.max(0, toUnit(rect.top, metrics.rowStep));
  const w = Math.max(1, toUnit(rect.width + safeGap, metrics.colStep));
  const h = Math.max(1, toUnit(rect.height + safeGap, metrics.rowStep));
  return { x, y, w, h };
}

export function clampGridRect(rect: GridRect, columns: number, maxRows: number): GridRect {
  const safeColumns = Math.max(1, Math.trunc(columns));
  const safeRows = Math.max(1, Math.trunc(maxRows));
  const w = clampNumber(Math.trunc(rect.w || 1), 1, safeColumns);
  const h = clampNumber(Math.trunc(rect.h || 1), 1, safeRows);
  const x = clampNumber(Math.trunc(rect.x || 0), 0, Math.max(0, safeColumns - w));
  const y = clampNumber(Math.trunc(rect.y || 0), 0, Math.max(0, safeRows - h));
  return { x, y, w, h };
}

export function maxRowsFromArtboard(artboardHeight: number, rowHeight: number, gap: number): number {
  const step = Math.max(12, rowHeight) + Math.max(0, gap);
  return Math.max(1, Math.floor((Math.max(120, artboardHeight) + Math.max(0, gap)) / step));
}

export function clientToLogicalPoint(
  clientX: number,
  clientY: number,
  surfaceRect: DOMRect,
  zoom: number,
): LogicalPoint {
  const safeZoom = clampNumber(zoom, 0.5, 2);
  return {
    x: (clientX - surfaceRect.left) / safeZoom,
    y: (clientY - surfaceRect.top) / safeZoom,
  };
}
