import React, { type CSSProperties, type DragEvent, type ReactNode, useState } from 'react';
import type { ColumnNode } from '@platform/schema';
import {
  allowPaletteDrop,
  readPaletteDragItem,
  type DropTarget,
  type PaletteDragItem,
} from '../../utils/DragDropManager';
import styles from './LayoutContainers.module.css';

type ColumnStyleVariables = CSSProperties & {
  '--column-span': string;
  '--column-span-desktop': string;
  '--column-span-tablet': string;
  '--column-span-mobile': string;
};

export interface ColumnContainerProps {
  column: ColumnNode;
  editMode: boolean;
  previewBreakpoint?: 'desktop' | 'tablet' | 'mobile';
  selected: boolean;
  defaultSpan: number;
  onSelect: (columnId: string) => void;
  onDropItem: (target: DropTarget, item: PaletteDragItem) => void;
  children: ReactNode;
}

export function ColumnContainer({
  column,
  editMode,
  previewBreakpoint = 'desktop',
  selected,
  defaultSpan,
  onSelect,
  onDropItem,
  children,
}: ColumnContainerProps) {
  const [isDropActive, setDropActive] = useState(false);

  const handleColumnDrop = (event: DragEvent<HTMLDivElement>) => {
    const item = readPaletteDragItem(event.dataTransfer);
    if (!item || (item.kind !== 'component' && item.kind !== 'section')) {
      return;
    }
    event.preventDefault();
    setDropActive(false);
    onDropItem({ kind: 'column', columnId: column.id }, item);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    const item = readPaletteDragItem(event.dataTransfer);
    if (!item || (item.kind !== 'component' && item.kind !== 'section')) {
      return;
    }
    allowPaletteDrop(event);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    const item = readPaletteDragItem(event.dataTransfer);
    if (!item || (item.kind !== 'component' && item.kind !== 'section')) {
      return;
    }
    allowPaletteDrop(event);
    setDropActive(true);
  };

  const handleDragLeave = () => {
    setDropActive(false);
  };

  const columnSpan = clampSpan(column.span ?? defaultSpan);
  const resolvedSpans = resolveResponsiveSpans(column, columnSpan);
  const columnStyle: ColumnStyleVariables = {
    '--column-span': String(columnSpan),
    '--column-span-desktop': String(resolvedSpans.desktop),
    '--column-span-tablet': String(resolvedSpans.tablet),
    '--column-span-mobile': String(resolvedSpans.mobile),
  };
  const activeSpan =
    previewBreakpoint === 'mobile'
      ? resolvedSpans.mobile
      : previewBreakpoint === 'tablet'
        ? resolvedSpans.tablet
        : resolvedSpans.desktop;
  columnStyle['--column-span'] = String(activeSpan);
  const cssVars = column.props?.cssVars;
  if (cssVars && typeof cssVars === 'object' && !Array.isArray(cssVars)) {
    for (const [key, value] of Object.entries(cssVars)) {
      if (!key.startsWith('--')) continue;
      if (typeof value === 'string' || typeof value === 'number') {
        (columnStyle as unknown as Record<string, string | number>)[key] = value;
      }
    }
  }

  return (
    <div
      className={[
        styles.column,
        !editMode ? styles.columnPreview : '',
        selected ? styles.columnSelected : '',
      ].join(' ')}
      style={columnStyle}
      aria-label={column.label ?? 'Column'}
    >
      <header className={styles.columnHeader}>
        <button
          type="button"
          className={styles.columnSelectButton}
          onClick={() => onSelect(column.id)}
          aria-pressed={selected}
        >
          {column.label ?? `Column ${columnSpan}/12`}
        </button>
        <span className={styles.columnBadge}>Column</span>
      </header>
      <div className={styles.columnBody}>{children}</div>
      {editMode ? (
        <div
          className={[styles.dropZone, isDropActive ? styles.dropZoneActive : ''].join(' ')}
          onDrop={handleColumnDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          aria-label={`Drop section or component into column ${column.id}`}
        >
          Drop Component or Section Here
        </div>
      ) : null}
    </div>
  );
}

function clampSpan(value: number): number {
  return Math.max(1, Math.min(12, Math.round(value)));
}

function resolveResponsiveSpans(column: ColumnNode, baseSpan: number): {
  desktop: number;
  tablet: number;
  mobile: number;
} {
  const props = column.props ?? {};
  return {
    desktop: clampSpan(typeof props.spanDesktop === 'number' ? props.spanDesktop : baseSpan),
    tablet: clampSpan(typeof props.spanTablet === 'number' ? props.spanTablet : Math.min(baseSpan, 12)),
    mobile: clampSpan(typeof props.spanMobile === 'number' ? props.spanMobile : 12),
  };
}
