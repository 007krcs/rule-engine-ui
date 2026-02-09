import * as React from 'react';
import styles from './badge.module.css';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'muted';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        styles.badge,
        variant === 'success' ? styles.success : variant === 'warning' ? styles.warning : variant === 'muted' ? styles.muted : styles.default,
        className,
      )}
      {...props}
    />
  );
}

