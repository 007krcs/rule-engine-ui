import {
  useEffect,
  useId,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  children: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
}

export function Modal({
  open,
  title,
  description,
  size = 'md',
  children,
  actions,
  onClose,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  initialFocusRef,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      lastFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusTarget = initialFocusRef?.current ?? findFirstFocusable(dialog) ?? dialog;
    focusTarget.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose?.();
        return;
      }
      if (event.key === 'Tab') {
        trapFocus(dialog, event);
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeOnEscape, onClose, initialFocusRef]);

  const dialog = useMemo(() => {
    if (!open) return null;
    return (
      <div className={styles.overlay} role="presentation">
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close dialog"
          onClick={closeOnOverlayClick ? onClose : undefined}
        />
        <div
          ref={dialogRef}
          className={[
            styles.dialog,
            size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd,
          ]
            .join(' ')
            .trim()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
        >
          {(title || description || onClose) && (
            <header className={styles.header}>
              <div>
                {title ? (
                  <h2 id={titleId} className={styles.title}>
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p id={descriptionId} className={styles.description}>
                    {description}
                  </p>
                ) : null}
              </div>
              {onClose ? (
                <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close dialog">
                  x
                </button>
              ) : null}
            </header>
          )}
          <div className={styles.body}>{children}</div>
          {actions ? <footer className={styles.footer}>{actions}</footer> : null}
        </div>
      </div>
    );
  }, [actions, closeOnOverlayClick, description, onClose, open, size, title, titleId, descriptionId]);

  if (!open) return null;
  if (typeof document === 'undefined') return dialog;
  return createPortal(dialog, document.body);
}

function findFirstFocusable(root: HTMLElement): HTMLElement | null {
  const focusable = root.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  for (const element of Array.from(focusable)) {
    if (!element.hasAttribute('disabled') && !element.getAttribute('aria-hidden')) {
      return element;
    }
  }
  return null;
}

function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));

  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  const active = document.activeElement as HTMLElement | null;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
