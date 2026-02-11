'use client';

import type * as React from 'react';
import type { UIComponent } from '@platform/schema';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './canvas-item.module.css';

export function CanvasItem({
  component,
  selected,
  disabled,
  onSelect,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  children,
}: {
  component: UIComponent;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component.id,
    data: { kind: 'component', componentId: component.id },
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-component-id={component.id}
      data-testid={`canvas-item-${component.id}`}
      className={cn(styles.item, selected ? styles.selected : undefined, isDragging ? styles.dragging : undefined)}
      onClick={onSelect}
      role="button"
      aria-label={`Select ${component.id}`}
      aria-pressed={selected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className={styles.bar}>
        <div className={styles.left}>
          <button type="button" className={styles.handle} aria-label={`Drag ${component.id}`} {...attributes} {...listeners}>
            <GripVertical size={16} aria-hidden="true" focusable="false" />
          </button>
          <div className={styles.meta}>
            <p className={styles.id}>{component.id}</p>
            <p className={styles.hint}>{component.adapterHint}</p>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.moveButton}
            onClick={(event) => {
              event.stopPropagation();
              onMoveUp?.();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onMoveUp?.();
                return;
              }
              event.stopPropagation();
            }}
            onKeyUp={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              event.stopPropagation();
            }}
            disabled={!canMoveUp || disabled}
            aria-label={`Move ${component.id} up`}
            data-testid={`canvas-move-up-${component.id}`}
          >
            <span aria-hidden="true">↑</span>
            <span>Move up</span>
          </button>
          <button
            type="button"
            className={styles.moveButton}
            onClick={(event) => {
              event.stopPropagation();
              onMoveDown?.();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onMoveDown?.();
                return;
              }
              event.stopPropagation();
            }}
            onKeyUp={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              event.stopPropagation();
            }}
            disabled={!canMoveDown || disabled}
            aria-label={`Move ${component.id} down`}
            data-testid={`canvas-move-down-${component.id}`}
          >
            <span aria-hidden="true">↓</span>
            <span>Move down</span>
          </button>
          <span className={styles.chip}>{component.type}</span>
        </div>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
