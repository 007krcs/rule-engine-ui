import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

export type ToastIntent = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  intent?: ToastIntent;
  durationMs?: number;
}

type ToastRecord = ToastOptions & {
  id: string;
  createdAt: number;
};

export interface ToastContextValue {
  notify: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
  defaultDurationMs?: number;
  ariaLabel?: string;
}

export function ToastProvider({
  children,
  maxToasts = 4,
  defaultDurationMs = 4500,
  ariaLabel = 'Notifications',
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (options: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const record: ToastRecord = {
        id,
        createdAt: Date.now(),
        title: options.title,
        description: options.description,
        intent: options.intent ?? 'info',
        durationMs: options.durationMs ?? defaultDurationMs,
      };
      setToasts((current) => [record, ...current].slice(0, maxToasts));
      return id;
    },
    [defaultDurationMs, maxToasts],
  );

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismiss(toast.id), toast.durationMs ?? defaultDurationMs),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [defaultDurationMs, dismiss, toasts]);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.viewport} role="region" aria-live="polite" aria-label={ariaLabel}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              styles.toast,
              toast.intent === 'success'
                ? styles.toastSuccess
                : toast.intent === 'warning'
                  ? styles.toastWarning
                  : toast.intent === 'error'
                    ? styles.toastError
                    : styles.toastInfo,
            ]
              .join(' ')
              .trim()}
            role="status"
          >
            <div className={styles.toastHeader}>
              <div>
                <p className={styles.toastTitle}>{toast.title}</p>
                {toast.description ? <p className={styles.toastDescription}>{toast.description}</p> : null}
              </div>
              <button
                type="button"
                className={styles.toastClose}
                aria-label="Dismiss notification"
                onClick={() => dismiss(toast.id)}
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider.');
  }
  return context;
}
