import type { ReactNode } from 'react';
import type { RowNode } from '@platform/schema';
import styles from './LayoutContainers.module.css';

export interface RowContainerProps {
  row: RowNode;
  editMode: boolean;
  selected: boolean;
  onSelect: (rowId: string) => void;
  children: ReactNode;
}

export function RowContainer({ row, editMode, selected, onSelect, children }: RowContainerProps) {
  return (
    <div
      className={[
        styles.row,
        !editMode ? styles.rowPreview : '',
        selected ? styles.rowSelected : '',
      ].join(' ')}
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
