import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from './utils';

export type PFAccordionSummaryProps = HTMLAttributes<HTMLDivElement>;

export function PFAccordionSummary({ className, ...rest }: PFAccordionSummaryProps) {
  return <div className={cn('pf-accordion__summary-content', className)} {...rest} />;
}

export type PFAccordionDetailsProps = HTMLAttributes<HTMLDivElement>;

export function PFAccordionDetails({ className, ...rest }: PFAccordionDetailsProps) {
  return <div className={cn('pf-accordion__details-content', className)} {...rest} />;
}

export interface PFAccordionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  expanded?: boolean;
  defaultExpanded?: boolean;
  disabled?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function PFAccordion({
  title,
  className,
  children,
  expanded,
  defaultExpanded = false,
  disabled = false,
  onExpandedChange,
  ...rest
}: PFAccordionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? internalExpanded;
  const accordionId = useId();
  const summaryId = `${accordionId}-summary`;
  const panelId = `${accordionId}-panel`;

  let summary: ReactNode = title;
  const detailBlocks: ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    if (isValidElement(child) && child.type === PFAccordionSummary) {
      summary = child;
      continue;
    }
    if (isValidElement(child) && child.type === PFAccordionDetails) {
      detailBlocks.push(child);
      continue;
    }
    detailBlocks.push(child);
  }

  const toggle = (): void => {
    if (disabled) return;
    const next = !isExpanded;
    onExpandedChange?.(next);
    if (expanded === undefined) setInternalExpanded(next);
  };

  return (
    <section
      className={cn(
        'pf-accordion',
        isExpanded && 'is-expanded',
        disabled && 'is-disabled',
        className,
      )}
      {...rest}
    >
      <h3 className="pf-accordion__heading">
        <button
          id={summaryId}
          type="button"
          className="pf-accordion__summary"
          aria-expanded={isExpanded}
          aria-controls={panelId}
          disabled={disabled}
          onClick={toggle}
        >
          <span className="pf-accordion__label">{summary}</span>
          <span className="pf-accordion__icon" aria-hidden="true">
            v
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={summaryId}
        className="pf-accordion__details"
        hidden={!isExpanded}
      >
        {detailBlocks}
      </div>
    </section>
  );
}

export interface PFPopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean;
  anchorRef?: RefObject<HTMLElement | null>;
  anchorEl?: HTMLElement | null;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  onClose?: () => void;
  trapFocus?: boolean;
  closeOnClickAway?: boolean;
  closeOnEscape?: boolean;
}

export function PFPopover({
  open,
  anchorRef,
  anchorEl,
  placement = 'bottom',
  offset = 10,
  onClose,
  trapFocus = false,
  closeOnClickAway = true,
  closeOnEscape = true,
  className,
  children,
  ...rest
}: PFPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });

  const resolvedAnchor = anchorEl ?? anchorRef?.current ?? null;

  const refreshPosition = useMemo(
    () => () => {
      const anchor = resolvedAnchor;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;

      const anchorRect = anchor.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();

      let top = anchorRect.bottom + offset;
      let left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;

      if (placement === 'top') {
        top = anchorRect.top - popoverRect.height - offset;
      } else if (placement === 'left') {
        top = anchorRect.top + anchorRect.height / 2 - popoverRect.height / 2;
        left = anchorRect.left - popoverRect.width - offset;
      } else if (placement === 'right') {
        top = anchorRect.top + anchorRect.height / 2 - popoverRect.height / 2;
        left = anchorRect.right + offset;
      }

      const maxLeft = window.innerWidth - popoverRect.width - 8;
      const maxTop = window.innerHeight - popoverRect.height - 8;
      setPosition({
        left: Math.max(8, Math.min(left, maxLeft)),
        top: Math.max(8, Math.min(top, maxTop)),
      });
    },
    [offset, placement, resolvedAnchor],
  );

  useEffect(() => {
    if (!open) return;
    refreshPosition();
    window.addEventListener('resize', refreshPosition);
    window.addEventListener('scroll', refreshPosition, true);
    return () => {
      window.removeEventListener('resize', refreshPosition);
      window.removeEventListener('scroll', refreshPosition, true);
    };
  }, [open, refreshPosition]);

  useEffect(() => {
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent): void => {
      if (!closeOnClickAway) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (popoverRef.current?.contains(target)) return;
      if (resolvedAnchor?.contains(target)) return;
      onClose?.();
    };
    const onWindowKeyDown = (event: KeyboardEvent): void => {
      if (!closeOnEscape) return;
      if (event.key === 'Escape') onClose?.();
    };

    document.addEventListener('mousedown', onDocumentMouseDown);
    window.addEventListener('keydown', onWindowKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      window.removeEventListener('keydown', onWindowKeyDown);
    };
  }, [closeOnClickAway, closeOnEscape, onClose, open, resolvedAnchor]);

  useEffect(() => {
    if (!open || !trapFocus) return;
    const node = popoverRef.current;
    if (!node) return;
    const focusable = node.querySelectorAll<HTMLElement>(
      [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
    };
  }, [open, trapFocus]);

  if (!open) return null;

  return (
    <div className="pf-popover-layer">
      <div
        ref={popoverRef}
        className={cn('pf-popover', 'pf-surface-panel', `pf-popover--${placement}`, className)}
        role="dialog"
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
        {...rest}
      >
        {children}
      </div>
    </div>
  );
}
