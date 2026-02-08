'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
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

function variantStyles(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'error':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    default:
      return 'border-border bg-surface text-foreground';
  }
}

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
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] w-[360px] max-w-[calc(100vw-2rem)] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto rounded-xl border p-4 shadow-card backdrop-blur supports-[backdrop-filter]:bg-surface/90',
              variantStyles(t.variant ?? 'info'),
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{t.title}</p>
                {t.description ? <p className="mt-1 text-xs text-muted-foreground">{t.description}</p> : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                aria-label="Dismiss toast"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== t.id))}
              >
                <X className="h-4 w-4" />
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

