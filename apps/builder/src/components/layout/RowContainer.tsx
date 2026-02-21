import React, { type CSSProperties, type ReactNode } from 'react';
import type { RowNode } from '@platform/schema';
import styles from './LayoutContainers.module.css';

export interface RowContainerProps {
  row: RowNode;
  editMode: boolean;
  previewBreakpoint?: 'desktop' | 'tablet' | 'mobile';
  selected: boolean;
  onSelect: (rowId: string) => void;
  children: ReactNode;
}

type RowStyleVariables = CSSProperties & {
  '--row-columns-desktop': string;
  '--row-columns-tablet': string;
  '--row-columns-mobile': string;
};

export function RowContainer({
  row,
  editMode,
  previewBreakpoint = 'desktop',
  selected,
  onSelect,
  children,
}: RowContainerProps) {
  const style = resolveRowStyle(row, previewBreakpoint);
  return (
    <div
      className={[
        styles.row,
        !editMode ? styles.rowPreview : '',
        selected ? styles.rowSelected : '',
      ].join(' ')}
      style={style}
      aria-label={row.label ?? 'Row'}
    >
      <header className={styles.rowHeader}>
        <button
          type="button"
          className={styles.rowSelectButton}
          onClick={() => onSelect(row.id)}
          aria-pressed={selected}
        >
          {row.label ?? 'Layout Row'}
        </button>
        <span className={styles.rowBadge}>Row</span>
      </header>
      <div className={styles.rowGrid}>{children}</div>
    </div>
  );
}

function resolveRowStyle(
  row: RowNode,
  _previewBreakpoint: 'desktop' | 'tablet' | 'mobile',
): RowStyleVariables {
  const props = row.props ?? {};
  const desktop = toColumns(props.columnsDesktop, 12);
  const tablet = toColumns(props.columnsTablet, Math.min(desktop, 6));
  const mobile = toColumns(props.columnsMobile, 1);
  return {
    '--row-columns-desktop': String(desktop),
    '--row-columns-tablet': String(tablet),
    '--row-columns-mobile': String(mobile),
  };
}

function toColumns(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(12, Math.round(value)));
}
