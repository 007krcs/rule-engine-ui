'use client';

import { cn } from '@/lib/utils';
import styles from './UiKitTabs.module.scss';

export type UiKitTabId = 'preview' | 'props' | 'code' | 'tokens' | 'accessibility';

export type UiKitTab = {
  id: UiKitTabId;
  label: string;
};

export interface UiKitTabsProps {
  tabs: UiKitTab[];
  activeTab: UiKitTabId;
  onChange: (tab: UiKitTabId) => void;
}

export function UiKitTabs({ tabs, activeTab, onChange }: UiKitTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Component explorer sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cn(styles.tab, activeTab === tab.id && styles.tabActive)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
          data-testid={`ui-kit-tab-${tab.id}`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
