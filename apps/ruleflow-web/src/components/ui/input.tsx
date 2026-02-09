import * as React from 'react';
import styles from './input.module.css';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(styles.input, className)} {...props} />
));
Input.displayName = 'Input';
