import { useId, useMemo, useState, useRef, type ReactNode, type KeyboardEvent } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: ReactNode;
  content?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}

export function Tabs({ items, value, defaultValue, onChange, ariaLabel, className }: TabsProps) {
  const fallbackId = useId();
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? value ?? items.find((item) => !item.disabled)?.id ?? '',
  );
  const activeValue = value ?? internalValue;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectTab = (nextValue: string) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabledTabs = items.filter((item) => !item.disabled);
    if (enabledTabs.length === 0) return;
    const currentIndex = enabledTabs.findIndex((item) => item.id === activeValue);
    let nextIndex = currentIndex;

    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = enabledTabs.length - 1;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1 + enabledTabs.length) % enabledTabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;

    const nextTab = enabledTabs[nextIndex];
    if (!nextTab) return;
    const originalIndex = items.findIndex((item) => item.id === nextTab.id);
    tabRefs.current[originalIndex]?.focus();
    selectTab(nextTab.id);
  };

  const panels = useMemo(
    () =>
      items.map((item) => (
        <div
          key={item.id}
          id={`${fallbackId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${fallbackId}-tab-${item.id}`}
          className={styles.panel}
          hidden={item.id !== activeValue}
        >
          {item.content}
        </div>
      )),
    [activeValue, fallbackId, items],
  );

  return (
    <div className={[styles.tabs, className ?? ''].join(' ').trim()}>
      <div
        className={styles.tabList}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
      >
        {items.map((item, index) => {
          const isActive = item.id === activeValue;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${fallbackId}-tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`${fallbackId}-panel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              className={[
                styles.tab,
                isActive ? styles.tabActive : '',
                item.disabled ? styles.tabDisabled : '',
              ]
                .join(' ')
                .trim()}
              onClick={() => {
                if (!item.disabled) selectTab(item.id);
              }}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {panels}
    </div>
  );
}
