import * as React from 'react';
import styles from './textarea.module.css';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(styles.textarea, className)} {...props} />
));
Textarea.displayName = 'Textarea';

