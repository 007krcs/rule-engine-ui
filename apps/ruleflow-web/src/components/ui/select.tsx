import * as React from 'react';
import styles from './select.module.css';
import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  const hasAccessibleName = Boolean(props['aria-label'] || props['aria-labelledby']);
  const fallbackLabel = hasAccessibleName ? undefined : props.name || props.id || 'Select field';
  return <select className={cn(styles.select, className)} aria-label={fallbackLabel} {...props} />;
}
