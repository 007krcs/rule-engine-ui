import type { DragEvent, KeyboardEvent, ReactNode } from 'react';
import { useState } from 'react';
import type { LayoutColumnChildNode, LayoutComponentNode, RowNode, SectionNode, UISchema } from '@platform/schema';
import { ColumnContainer } from './layout/ColumnContainer';
import { RowContainer } from './layout/RowContainer';
import { SectionContainer } from './layout/SectionContainer';
import {
  allowPaletteDrop,
  readPaletteDragItem,
  type DropTarget,
  type PaletteDragItem,
} from '../utils/DragDropManager';
import styles from './Canvas.module.css';

export interface CanvasProps {
  schema: UISchema;
  editMode?: boolean;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onDropPaletteItem: (target: DropTarget, item: PaletteDragItem) => void;
}

export function Canvas({
  schema,
  editMode = true,
  selectedNodeId,
  onSelectNode,
  onDropPaletteItem,
}: CanvasProps) {
  const [isCanvasDropActive, setCanvasDropActive] = useState(false);
  const sections = schema.sections ?? [];

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    const item = readPaletteDragItem(event.dataTransfer);
    if (!item) {
      return;
    }
    event.preventDefault();
    setCanvasDropActive(false);
    onDropPaletteItem({ kind: 'canvas' }, item);
  };

  const handleCanvasDragOver = (event: DragEvent<HTMLDivElement>) => {
    const item = readPaletteDragItem(event.dataTransfer);
    if (!item) {
      return;
    }
    allowPaletteDrop(event);
  };

  const handleCanvasDragEnter = (event: DragEvent<HTMLDivElement>) => {
    const item = readPaletteDragItem(event.dataTransfer);
    if (!item) {
      return;
    }
    allowPaletteDrop(event);
    setCanvasDropActive(true);
  };

  const handleCanvasDragLeave = () => {
    setCanvasDropActive(false);
  };

  const renderLayoutComponent = (componentNode: LayoutComponentNode) => {
    const selected = selectedNodeId === componentNode.id;
    const label = componentNode.label ?? componentNode.componentType ?? componentNode.componentId;

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelectNode(componentNode.id);
      }
    };

    return (
      <article
        key={componentNode.id}
        className={[styles.componentCard, selected ? styles.componentCardSelected : ''].join(' ')}
        role="button"
        tabIndex={0}
        onClick={() => onSelectNode(componentNode.id)}
        onKeyDown={handleKeyDown}
        aria-label={`Component ${label}`}
        aria-pressed={selected}
      >
        <h4>{label}</h4>
        <p>ID: {componentNode.componentId}</p>
        <span>Type: {componentNode.componentType ?? 'unknown'}</span>
      </article>
    );
  };

  const renderColumnChild = (child: LayoutColumnChildNode): ReactNode => {
    if (child.kind === 'section') {
      return renderSectionNode(child);
    }
    return renderLayoutComponent(child);
  };

  const renderRowNode = (row: RowNode) => {
    const defaultColumnSpan = getDefaultColumnSpan(row.columns.length);
    return (
      <RowContainer
        key={row.id}
        row={row}
        editMode={editMode}
        selected={selectedNodeId === row.id}
        onSelect={onSelectNode}
      >
        {row.columns.map((column) => (
          <ColumnContainer
            key={column.id}
            column={column}
            editMode={editMode}
            selected={selectedNodeId === column.id}
            defaultSpan={defaultColumnSpan}
            onSelect={onSelectNode}
            onDropItem={onDropPaletteItem}
          >
            {column.children.length === 0 ? (
              <p className={styles.emptyColumnMessage}>
                {editMode ? 'Drop components or sections into this column.' : 'No items'}
              </p>
            ) : null}
            {column.children.map((child) => renderColumnChild(child))}
          </ColumnContainer>
        ))}
      </RowContainer>
    );
  };

  const renderSectionNode = (section: SectionNode): ReactNode => (
    <SectionContainer
      key={section.id}
      section={section}
      editMode={editMode}
      selected={selectedNodeId === section.id}
      onSelect={onSelectNode}
      onDropItem={onDropPaletteItem}
    >
      {section.rows.length === 0 ? (
        <div className={styles.emptySectionMessage}>Section has no rows. Drop a Row to begin.</div>
      ) : null}
      {section.rows.map((row) => renderRowNode(row))}
    </SectionContainer>
  );

  return (
    <section className={styles.canvasRoot} aria-label="Builder canvas">
      <header className={styles.canvasHeader}>
        <h2>Canvas</h2>
        <p>Section, Row, and Column containers render from the live schema tree.</p>
      </header>
      <div className={styles.canvasViewport} role="region" aria-label="Canvas viewport" tabIndex={0}>
        <div className={[styles.layoutTree, editMode ? styles.editMode : styles.previewMode].join(' ')}>
          {editMode ? (
            <div
              className={[
                styles.rootDropZone,
                isCanvasDropActive ? styles.rootDropZoneActive : '',
              ].join(' ')}
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
              onDragEnter={handleCanvasDragEnter}
              onDragLeave={handleCanvasDragLeave}
              aria-label="Drop section on canvas root"
            >
              Drop Section Here
            </div>
          ) : null}
          {sections.length === 0 ? (
            <div className={styles.emptyCanvasMessage}>
              Canvas is empty. Drag a Section from the palette to create the layout tree.
            </div>
          ) : (
            sections.map((section) => renderSectionNode(section))
          )}
        </div>
      </div>
    </section>
  );
}

function getDefaultColumnSpan(columnCount: number): number {
  const count = Math.max(1, columnCount);
  return Math.max(1, Math.floor(12 / count));
}
