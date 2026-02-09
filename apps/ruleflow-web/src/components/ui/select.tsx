import * as React from 'react';
import styles from './select.module.css';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, ...props }: SelectProps) {
  return <select className={cn(styles.select, className)} {...props} />;
}

