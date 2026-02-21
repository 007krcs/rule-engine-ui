import React, { type CSSProperties, type DragEvent, type ReactNode, useState } from 'react';
import type { SectionNode } from '@platform/schema';
import {
  allowPaletteDrop,
  readPaletteDragItem,
  type DropTarget,
  type PaletteDragItem,
} from '../../utils/DragDropManager';
import styles from './LayoutContainers.module.css';

export interface SectionContainerProps {
  section: SectionNode;
  editMode: boolean;
  previewBreakpoint?: 'desktop' | 'tablet' | 'mobile';
  selected: boolean;
  onSelect: (sectionId: string) => void;
  onDropItem: (target: DropTarget, item: PaletteDragItem) => void;
  children: ReactNode;
}

export function SectionContainer({
  section,
  editMode,
  previewBreakpoint = 'desktop',
  selected,
  onSelect,
  onDropItem,
  children,
}: SectionContainerProps) {
  const [isDropActive, setDropActive] = useState(false);
  const sectionStyle = buildSectionStyle(section, previewBreakpoint);

  const handleRowDrop = (event: DragEvent<HTMLDivElement>) => {
    const item = readPaletteDragItem(event.dataTransfer);
    if (!item || item.kind !== 'row') {
      return;
    }
    event.preventDefault();
    setDropActive(false);
    onDropItem({ kind: 'section', sectionId: section.id }, item);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    const item = readPaletteDragItem(event.dataTransfer);
    if (!item || item.kind !== 'row') {
      return;
    }
    allowPaletteDrop(event);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    const item = readPaletteDragItem(event.dataTransfer);
    if (!item || item.kind !== 'row') {
      return;
    }
    allowPaletteDrop(event);
    setDropActive(true);
  };

  const handleDragLeave = () => {
    setDropActive(false);
  };

  return (
    <section
      className={[
        styles.section,
        !editMode ? styles.sectionPreview : '',
        selected ? styles.sectionSelected : '',
      ].join(' ')}
      style={sectionStyle}
      aria-label={section.title ?? 'Section'}
    >
      <header className={styles.sectionHeader}>
        <button
          type="button"
          className={styles.sectionSelectButton}
          onClick={() => onSelect(section.id)}
          aria-pressed={selected}
        >
          {section.title ?? section.label ?? 'Untitled Section'}
        </button>
        <span className={styles.sectionBadge}>Section</span>
      </header>
      <div className={styles.sectionRows}>{children}</div>
      {editMode ? (
        <div
          className={[styles.dropZone, isDropActive ? styles.dropZoneActive : ''].join(' ')}
          onDrop={handleRowDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          aria-label={`Drop row into section ${section.title ?? section.id}`}
        >
          Drop Row Here
        </div>
      ) : null}
    </section>
  );
}

function buildSectionStyle(
  section: SectionNode,
  previewBreakpoint: 'desktop' | 'tablet' | 'mobile',
): CSSProperties {
  const style: CSSProperties = {
    '--layout-breakpoint': previewBreakpoint,
  } as CSSProperties;

  const cssVars = section.props?.cssVars;
  if (cssVars && typeof cssVars === 'object' && !Array.isArray(cssVars)) {
    for (const [key, value] of Object.entries(cssVars)) {
      if (!key.startsWith('--')) continue;
      if (typeof value === 'string' || typeof value === 'number') {
        (style as Record<string, string | number>)[key] = value;
      }
    }
  }
  return style;
}
