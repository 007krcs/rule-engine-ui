import type { DragEvent } from 'react';

export const PALETTE_MIME_TYPE = 'application/x-ruleflow-palette-item';

export type PaletteItemKind = 'section' | 'row' | 'component';

export interface PaletteDragItem {
  kind: PaletteItemKind;
  type: string;
  displayName: string;
}

export type DropTarget =
  | { kind: 'canvas' }
  | { kind: 'section'; sectionId: string }
  | { kind: 'row'; rowId: string }
  | { kind: 'column'; columnId: string };

export function setPaletteDragItem(dataTransfer: DataTransfer, item: PaletteDragItem): void {
  dataTransfer.setData(PALETTE_MIME_TYPE, JSON.stringify(item));
  dataTransfer.effectAllowed = 'copy';
}

export function readPaletteDragItem(dataTransfer: DataTransfer): PaletteDragItem | null {
  const rawValue = dataTransfer.getData(PALETTE_MIME_TYPE);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PaletteDragItem>;
    if (
      (parsed.kind === 'section' || parsed.kind === 'row' || parsed.kind === 'component') &&
      typeof parsed.type === 'string' &&
      parsed.type.length > 0 &&
      typeof parsed.displayName === 'string' &&
      parsed.displayName.length > 0
    ) {
      return {
        kind: parsed.kind,
        type: parsed.type,
        displayName: parsed.displayName,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function canAcceptPaletteDrop(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(PALETTE_MIME_TYPE);
}

export function allowPaletteDrop(event: DragEvent<HTMLElement>): void {
  if (!canAcceptPaletteDrop(event.dataTransfer)) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}
