import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn, keyboardSelectionHandler, sizeClass, type PFBaseProps } from './utils';

export interface PFTabItem {
  id: string;
  label: ReactNode;
  content?: ReactNode;
  disabled?: boolean;
}

export interface PFTabProps {
  value: string;
  label: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
}

export function PFTab(_props: PFTabProps): null {
  return null;
}

export interface PFTabsProps extends PFBaseProps {
  tabs?: PFTabItem[];
  children?: ReactNode;
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}

export function PFTabs({
  tabs = [],
  children,
  value,
  onChange,
  className,
  size = 'md',
  ariaLabel = 'Tabs',
}: PFTabsProps) {
  const childTabs: PFTabItem[] = useMemo(() => {
    if (!children) return [];
    const items: PFTabItem[] = [];
    for (const child of Children.toArray(children)) {
      if (!isValidElement<PFTabProps>(child)) continue;
      if (child.type !== PFTab) continue;
      items.push({
        id: child.props.value,
        label: child.props.label,
        content: child.props.children,
        disabled: child.props.disabled,
      });
    }
    return items;
  }, [children]);

  const normalizedTabs = childTabs.length > 0 ? childTabs : tabs;

  const selectedIndex = normalizedTabs.findIndex((tab) => tab.id === value);
  const currentTab = selectedIndex >= 0 ? normalizedTabs[selectedIndex] : normalizedTabs[0];

  const selectByOffset = (index: number, offset: number): string | null => {
    let nextIndex = index;
    for (let step = 0; step < normalizedTabs.length; step += 1) {
      nextIndex = (nextIndex + offset + normalizedTabs.length) % normalizedTabs.length;
      if (!normalizedTabs[nextIndex]?.disabled) return normalizedTabs[nextIndex]?.id ?? null;
    }
    return null;
  };

  return (
    <div className={cn('pf-tabs', sizeClass(size), className)}>
      <div className="pf-tabs__list" role="tablist" aria-label={ariaLabel}>
        {normalizedTabs.map((tab, index) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              id={`pf-tab-${tab.id}`}
              className={cn('pf-tabs__tab', selected && 'is-active')}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`pf-tab-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange?.(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  const nextId = selectByOffset(index, 1);
                  if (nextId) onChange?.(nextId);
                }
                if (event.key === 'ArrowLeft') {
                  const nextId = selectByOffset(index, -1);
                  if (nextId) onChange?.(nextId);
                }
                if (event.key === 'Home') onChange?.(normalizedTabs[0]?.id ?? value);
                if (event.key === 'End') onChange?.(normalizedTabs[normalizedTabs.length - 1]?.id ?? value);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {currentTab ? (
        <section
          className="pf-tabs__panel"
          id={`pf-tab-panel-${currentTab.id}`}
          role="tabpanel"
          aria-labelledby={`pf-tab-${currentTab.id}`}
        >
          {currentTab.content}
        </section>
      ) : null}
    </div>
  );
}

export interface PFBreadcrumbItem {
  id: string;
  label: ReactNode;
  href?: string;
  onClick?: () => void;
  current?: boolean;
}

export interface PFBreadcrumbsProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  items: PFBreadcrumbItem[];
  separator?: ReactNode;
}

export function PFBreadcrumbs({
  items,
  separator = '/',
  className,
  ...rest
}: PFBreadcrumbsProps) {
  return (
    <nav className={cn('pf-breadcrumbs', className)} aria-label="Breadcrumb" {...rest}>
      <ol className="pf-breadcrumbs__list">
        {items.map((item, index) => (
          <li key={item.id} className="pf-breadcrumbs__item">
            {item.href ? (
              <a href={item.href} onClick={item.onClick} aria-current={item.current ? 'page' : undefined}>
                {item.label}
              </a>
            ) : (
              <button
                type="button"
                className="pf-breadcrumbs__button"
                onClick={item.onClick}
                aria-current={item.current ? 'page' : undefined}
              >
                {item.label}
              </button>
            )}
            {index < items.length - 1 ? <span className="pf-breadcrumbs__separator">{separator}</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface PFMenuItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface PFMenuProps extends PFBaseProps {
  triggerLabel: ReactNode;
  items: PFMenuItem[];
  onSelect?: (id: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function PFMenu({
  triggerLabel,
  items,
  onSelect,
  open,
  onOpenChange,
  className,
  size = 'md',
}: PFMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOpen = open ?? internalOpen;

  const setOpen = (next: boolean): void => {
    onOpenChange?.(next);
    if (open === undefined) setInternalOpen(next);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onDocumentClick = (event: MouseEvent): void => {
      if (!menuRef.current) return;
      if (event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
    };
  }, [isOpen]);

  return (
    <div className={cn('pf-menu', sizeClass(size), className)} ref={menuRef}>
      <button
        type="button"
        className="pf-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
      >
        {triggerLabel}
      </button>
      {isOpen ? (
        <ul className="pf-menu__list" role="menu">
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                className="pf-menu__item"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  onSelect?.(item.id);
                  setOpen(false);
                }}
                onKeyDown={(event) =>
                  keyboardSelectionHandler(event, () => {
                    onSelect?.(item.id);
                    setOpen(false);
                  })
                }
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface PFPaginationProps extends PFBaseProps {
  count: number;
  page: number;
  onPageChange?: (page: number) => void;
  siblingCount?: number;
  className?: string;
}

export function PFPagination({
  count,
  page,
  onPageChange,
  siblingCount = 1,
  className,
  size = 'md',
}: PFPaginationProps) {
  const safeCount = Math.max(count, 1);
  const pages = useMemo(() => {
    const total = safeCount;
    const windowStart = Math.max(1, page - siblingCount);
    const windowEnd = Math.min(total, page + siblingCount);
    const numbers = new Set<number>([1, total]);
    for (let i = windowStart; i <= windowEnd; i += 1) numbers.add(i);
    return Array.from(numbers).sort((a, b) => a - b);
  }, [safeCount, page, siblingCount]);

  return (
    <nav className={cn('pf-pagination', sizeClass(size), className)} aria-label="Pagination">
      <button type="button" onClick={() => onPageChange?.(Math.max(1, page - 1))} disabled={page <= 1}>
        Prev
      </button>
      {pages.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onPageChange?.(value)}
          aria-current={value === page ? 'page' : undefined}
          className={cn(value === page && 'is-active')}
        >
          {value}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange?.(Math.min(safeCount, page + 1))}
        disabled={page >= safeCount}
      >
        Next
      </button>
    </nav>
  );
}

export interface PFStep {
  id: string;
  label: ReactNode;
  description?: ReactNode;
}

export interface PFStepperProps extends PFBaseProps {
  steps: PFStep[];
  activeStep: number;
  className?: string;
}

export function PFStepper({
  steps,
  activeStep,
  className,
  size = 'md',
}: PFStepperProps) {
  return (
    <ol className={cn('pf-stepper', sizeClass(size), className)}>
      {steps.map((step, index) => {
        const state = index < activeStep ? 'complete' : index === activeStep ? 'active' : 'upcoming';
        return (
          <li key={step.id} className={cn('pf-stepper__item', `is-${state}`)}>
            <span className="pf-stepper__index" aria-hidden="true">
              {index + 1}
            </span>
            <span className="pf-stepper__text">
              <span className="pf-stepper__label">{step.label}</span>
              {step.description ? <span className="pf-stepper__description">{step.description}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
