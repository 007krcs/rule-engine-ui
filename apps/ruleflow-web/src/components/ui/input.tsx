import * as React from 'react';
import styles from './input.module.css';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  const hasAccessibleName = Boolean(props['aria-label'] || props['aria-labelledby']);
  const fallbackLabel = hasAccessibleName ? undefined : props.placeholder || props.name || props.id || 'Input field';
  return <input ref={ref} className={cn(styles.input, className)} aria-label={fallbackLabel} {...props} />;
});
Input.displayName = 'Input';
