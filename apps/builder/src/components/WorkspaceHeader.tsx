import React from 'react';
import styles from './WorkspaceHeader.module.css';

interface WorkspaceHeaderProps {
  title: string;
  subtitle?: string;
}

export function WorkspaceHeader({ title, subtitle }: WorkspaceHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.kicker}>Workspace</p>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
    </header>
  );
}
