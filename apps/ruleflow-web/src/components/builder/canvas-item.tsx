'use client';

import type * as React from 'react';
import type { UIComponent } from '@platform/schema';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './canvas-item.module.css';

export function CanvasItem({
  component,
  index,
  totalItems,
  selected,
  disabled,
  onSelect,
  onMove,
  onRemove,
  children,
}: {
  component: UIComponent;
  index: number;
  totalItems: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onMove?: (id: string, newIndex: number) => void;
  onRemove?: (id: string) => void;
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
  const canMoveUp = index > 0;
  const canMoveDown = index < totalItems - 1;

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
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
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
              onMove?.(component.id, index - 1);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onMove?.(component.id, index - 1);
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
            <span aria-hidden="true">^</span>
            <span>Move up</span>
          </button>
          <button
            type="button"
            className={styles.moveButton}
            onClick={(event) => {
              event.stopPropagation();
              onMove?.(component.id, index + 1);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onMove?.(component.id, index + 1);
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
            <span aria-hidden="true">v</span>
            <span>Move down</span>
          </button>
          <button
            type="button"
            className={styles.removeButton}
            onClick={(event) => {
              event.stopPropagation();
              onRemove?.(component.id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onRemove?.(component.id);
                return;
              }
              event.stopPropagation();
            }}
            aria-label={`Remove ${component.id}`}
            data-testid={`canvas-remove-${component.id}`}
            disabled={disabled}
          >
            <Trash2 size={14} aria-hidden="true" focusable="false" />
            <span>Remove</span>
          </button>
          <span className={styles.chip}>{component.type}</span>
        </div>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
