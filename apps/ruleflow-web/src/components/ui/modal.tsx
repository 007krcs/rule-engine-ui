'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './modal.module.css';
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
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <button type="button" className={styles.backdrop} aria-label="Close dialog" onClick={onClose} />
      <div
        className={cn(
          styles.dialog,
          size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd,
        )}
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <p className={styles.title}>{title}</p>
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X width={16} height={16} aria-hidden="true" focusable="false" />
          </Button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}

