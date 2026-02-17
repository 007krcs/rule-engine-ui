'use client';

import { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import styles from './modal.module.scss';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type ModalSize = 'sm' | 'md' | 'lg';

export function Modal({
  open,
  title,
  description,
  size = 'md',
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const root = document.documentElement;
    const lockCount = Number(body.getAttribute('data-rf-modal-lock-count') ?? '0');

    body.setAttribute('data-rf-modal-lock-count', String(lockCount + 1));
    if (lockCount === 0) {
      const scrollbarWidth = window.innerWidth - root.clientWidth;
      body.setAttribute('data-rf-modal-prev-overflow', body.style.overflow);
      body.setAttribute('data-rf-modal-prev-padding-right', body.style.paddingRight);
      root.setAttribute('data-rf-modal-prev-overflow', root.style.overflow);
      body.style.overflow = 'hidden';
      root.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    return () => {
      const nextCount = Math.max(0, Number(body.getAttribute('data-rf-modal-lock-count') ?? '1') - 1);
      body.setAttribute('data-rf-modal-lock-count', String(nextCount));
      if (nextCount === 0) {
        body.style.overflow = body.getAttribute('data-rf-modal-prev-overflow') ?? '';
        body.style.paddingRight = body.getAttribute('data-rf-modal-prev-padding-right') ?? '';
        root.style.overflow = root.getAttribute('data-rf-modal-prev-overflow') ?? '';
        body.removeAttribute('data-rf-modal-prev-overflow');
        body.removeAttribute('data-rf-modal-prev-padding-right');
        root.removeAttribute('data-rf-modal-prev-overflow');
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} data-testid="modal-overlay">
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close dialog"
        data-testid="modal-backdrop"
        onClick={onClose}
      />
      <div
        className={cn(
          styles.dialog,
          size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        data-testid="modal-dialog"
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <p id={titleId} className={styles.title}>
              {title}
            </p>
            {description ? (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X width={16} height={16} aria-hidden="true" focusable="false" />
          </Button>
        </div>
        <div className={cn(styles.body, 'rfScrollbar')} data-testid="modal-body">
          {children}
        </div>
        {footer ? (
          <div className={styles.footer} data-testid="modal-footer">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
