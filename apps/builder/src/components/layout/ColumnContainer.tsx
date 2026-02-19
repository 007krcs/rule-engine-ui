import type { CSSProperties, DragEvent, ReactNode } from 'react';
import { useState } from 'react';
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
};

export interface ColumnContainerProps {
  column: ColumnNode;
  editMode: boolean;
  selected: boolean;
  defaultSpan: number;
  onSelect: (columnId: string) => void;
  onDropItem: (target: DropTarget, item: PaletteDragItem) => void;
  children: ReactNode;
}

export function ColumnContainer({
  column,
  editMode,
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

  return (
    <div
      className={[
        styles.column,
        !editMode ? styles.columnPreview : '',
        selected ? styles.columnSelected : '',
      ].join(' ')}
      style={
        {
          '--column-span': String(columnSpan),
        } as ColumnStyleVariables
      }
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
