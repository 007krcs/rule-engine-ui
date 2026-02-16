import type { CSSProperties, KeyboardEvent } from 'react';

export type PFSize = 'sm' | 'md' | 'lg';
export type PFVariant = 'solid' | 'outline' | 'ghost';
export type PFIntent = 'neutral' | 'primary' | 'secondary' | 'success' | 'warn' | 'error';

export interface PFBaseProps {
  className?: string;
  size?: PFSize;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function sizeClass(size: PFSize = 'md'): string {
  return `pf-size-${size}`;
}

export function variantClass(prefix: string, variant: string): string {
  return `${prefix}--${variant}`;
}

export function intentClass(prefix: string, intent: PFIntent): string {
  return `${prefix}--${intent}`;
}

export function keyboardSelectionHandler(
  event: KeyboardEvent<HTMLElement>,
  onSelect: () => void,
): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSelect();
  }
}

export function cssVar(name: string, fallback?: string): string {
  if (fallback) return `var(${name}, ${fallback})`;
  return `var(${name})`;
}

export function toPx(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}

export function sizeStyle(
  width?: number | string,
  height?: number | string,
): CSSProperties | undefined {
  if (width === undefined && height === undefined) return undefined;
  return {
    width: width !== undefined ? toPx(width) : undefined,
    height: height !== undefined ? toPx(height) : undefined,
  };
}
