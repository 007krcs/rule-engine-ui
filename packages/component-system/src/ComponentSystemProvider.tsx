import type { PropsWithChildren } from 'react';
import styles from './ComponentSystemProvider.module.css';

export interface ComponentSystemProviderProps extends PropsWithChildren {
  className?: string;
}

export function ComponentSystemProvider({ children, className }: ComponentSystemProviderProps) {
  return <div className={[styles.themeRoot, className ?? ''].join(' ').trim()}>{children}</div>;
}
