import {
  type ButtonHTMLAttributes,
  Children,
  isValidElement,
  useEffect,
  useId,
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

export interface PFMenuOption {
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface PFMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
  selected?: boolean;
}

export function PFMenuItem({
  className,
  children,
  inset = false,
  selected = false,
  ...rest
}: PFMenuItemProps) {
  return (
    <button
      {...rest}
      type={rest.type ?? 'button'}
      className={cn(
        'pf-menu__item',
        inset && 'pf-menu__item--inset',
        selected && 'is-selected',
        className,
      )}
      role="menuitem"
    >
      {children}
    </button>
  );
}

export interface PFMenuProps extends PFBaseProps {
  triggerLabel: ReactNode;
  items?: PFMenuOption[];
  children?: ReactNode;
  onSelect?: (id: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  align?: 'start' | 'end';
}

export function PFMenu({
  triggerLabel,
  items = [],
  children,
  onSelect,
  open,
  onOpenChange,
  className,
  size = 'md',
  align = 'start',
}: PFMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isOpen = open ?? internalOpen;
  const menuId = useId();

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
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onDocumentClick);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      window.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const first = listRef.current?.querySelector<HTMLElement>('.pf-menu__item:not(:disabled)');
    first?.focus();
  }, [isOpen]);

  const renderedItems =
    children ??
    items.map((item) => (
      <li key={item.id} role="none">
        <PFMenuItem
          disabled={item.disabled}
          onClick={() => {
            onSelect?.(item.id);
            setOpen(false);
            triggerRef.current?.focus();
          }}
          onKeyDown={(event) =>
            keyboardSelectionHandler(event, () => {
              onSelect?.(item.id);
              setOpen(false);
              triggerRef.current?.focus();
            })
          }
        >
          {item.label}
        </PFMenuItem>
      </li>
    ));

  return (
    <div className={cn('pf-menu', sizeClass(size), className)} ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        className="pf-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {triggerLabel}
      </button>
      {isOpen ? (
        <ul
          className={cn('pf-menu__list', align === 'end' && 'pf-menu__list--end')}
          role="menu"
          id={menuId}
          ref={listRef}
          onKeyDown={(event) => {
            const nodes = Array.from(
              listRef.current?.querySelectorAll<HTMLElement>('.pf-menu__item:not(:disabled)') ?? [],
            );
            if (nodes.length === 0) return;

            const activeIndex = nodes.findIndex((node) => node === document.activeElement);
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              const next = activeIndex < 0 ? 0 : (activeIndex + 1) % nodes.length;
              nodes[next]?.focus();
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              const next = activeIndex < 0 ? nodes.length - 1 : (activeIndex - 1 + nodes.length) % nodes.length;
              nodes[next]?.focus();
            }
            if (event.key === 'Home') {
              event.preventDefault();
              nodes[0]?.focus();
            }
            if (event.key === 'End') {
              event.preventDefault();
              nodes[nodes.length - 1]?.focus();
            }
            if (event.key === 'Tab') {
              setOpen(false);
            }
          }}
        >
          {renderedItems}
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
