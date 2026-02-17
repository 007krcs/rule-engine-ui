import * as React from 'react';
import styles from './textarea.module.css';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  const hasAccessibleName = Boolean(props['aria-label'] || props['aria-labelledby']);
  const fallbackLabel = hasAccessibleName ? undefined : props.placeholder || props.name || props.id || 'Text area';
  return <textarea ref={ref} className={cn(styles.textarea, className)} aria-label={fallbackLabel} {...props} />;
});
Textarea.displayName = 'Textarea';
