'use client';

import type { ComponentDefinition } from '@platform/component-registry';
import { cn } from '@/lib/utils';
import styles from './UiKitSidebar.module.scss';

export type UiKitSidebarSection = {
  category: string;
  components: ComponentDefinition[];
};

export interface UiKitSidebarProps {
  sections: UiKitSidebarSection[];
  selectedHint: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (adapterHint: string) => void;
}

export function UiKitSidebar({
  sections,
  selectedHint,
  query,
  onQueryChange,
  onSelect,
}: UiKitSidebarProps) {
  return (
    <aside className={cn(styles.sidebar, 'rfScrollbar')} data-testid="ui-kit-sidebar">
      <div className={styles.searchWrap}>
        <label htmlFor="ui-kit-search-input" className={styles.searchLabel}>
          Search components
        </label>
        <input
          id="ui-kit-search-input"
          type="search"
          className={styles.searchInput}
          placeholder="Search by name or adapter hint"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          data-testid="ui-kit-search-input"
        />
      </div>

      <div className={styles.sectionList}>
        {sections.map((section) => (
          <section key={section.category} className={styles.section}>
            <h3 className={styles.sectionTitle}>{section.category}</h3>
            <ul className={styles.items} role="list">
              {section.components.map((component) => (
                <li key={component.adapterHint}>
                  <button
                    type="button"
                    className={cn(
                      styles.itemButton,
                      selectedHint === component.adapterHint && styles.itemButtonActive,
                    )}
                    onClick={() => onSelect(component.adapterHint)}
                    data-testid={`ui-kit-item-${component.adapterHint}`}
                  >
                    <span className={styles.itemText}>
                      <span className={styles.itemName}>{toDisplayName(component)}</span>
                      <span className={styles.itemHint}>{component.adapterHint}</span>
                    </span>
                    <span className={cn(styles.badge, statusClass(component.status))}>
                      {component.status ?? 'stable'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}

function toDisplayName(component: ComponentDefinition): string {
  if (component.adapterHint.startsWith('platform.')) {
    return `PF${component.displayName}`;
  }
  return component.displayName;
}

function statusClass(status: ComponentDefinition['status']): string {
  if (status === 'beta') return styles.badgeBeta ?? '';
  if (status === 'planned') return styles.badgePlanned ?? '';
  return styles.badgeStable ?? '';
}
