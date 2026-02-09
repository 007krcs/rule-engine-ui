'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import styles from './toast.module.css';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type ToastVariant = 'info' | 'success' | 'error';

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastRecord = ToastInput & {
  id: string;
  createdAt: number;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const toast = useCallback((input: ToastInput) => {
    const record: ToastRecord = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      variant: input.variant ?? 'info',
      durationMs: input.durationMs ?? 4500,
      createdAt: Date.now(),
    };
    setToasts((current) => [record, ...current].slice(0, 4));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== t.id));
      }, t.durationMs ?? 4500),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.container} aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(styles.toast, t.variant === 'success' ? styles.success : t.variant === 'error' ? styles.error : undefined)}
            role="status"
          >
            <div className={styles.header}>
              <div className={styles.titleWrap}>
                <p className={styles.title}>{t.title}</p>
                {t.description ? <p className={styles.description}>{t.description}</p> : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Dismiss toast"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== t.id))}
              >
                <X width={16} height={16} aria-hidden="true" focusable="false" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

