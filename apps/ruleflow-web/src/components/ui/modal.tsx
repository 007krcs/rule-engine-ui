'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type ModalSize = 'sm' | 'md' | 'lg';

function sizeClass(size: ModalSize) {
  switch (size) {
    case 'sm':
      return 'max-w-lg';
    case 'lg':
      return 'max-w-4xl';
    default:
      return 'max-w-2xl';
  }
}

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
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className={cn('relative w-full rounded-2xl border border-border bg-surface shadow-soft', sizeClass(size))}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{title}</p>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer ? <div className="border-t border-border px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

