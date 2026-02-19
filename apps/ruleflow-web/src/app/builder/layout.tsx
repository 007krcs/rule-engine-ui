"use client";

import type { ReactNode } from 'react';
import { BuilderProvider } from '@/context/BuilderContext';
import styles from './builder-layout.module.scss';

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.builderViewport}>
      <div className={styles.builderContent}>
        <BuilderProvider>{children}</BuilderProvider>
      </div>
    </div>
  );
}
