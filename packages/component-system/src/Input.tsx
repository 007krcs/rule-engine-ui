import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Input.module.css';

export type InputSize = 'sm' | 'md' | 'lg';
export type InputState = 'default' | 'error' | 'warning';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  warning?: ReactNode;
  size?: InputSize;
  state?: InputState;
}

export function Input({
  id,
  label,
  helperText,
  error,
  warning,
  size = 'md',
  state = 'default',
  className,
  ...rest
}: InputProps) {
  const fallbackId = useId();
  const resolvedId = id ?? `rf-input-${fallbackId}`;

  const currentState = error ? 'error' : warning ? 'warning' : state;
  const message = error ?? warning ?? helperText;
  const messageId = message ? `${resolvedId}-message` : undefined;

  return (
    <div className={styles.field}>
      {label ? (
        <label className={styles.label} htmlFor={resolvedId}>
          {label}
        </label>
      ) : null}
      <input
        {...rest}
        id={resolvedId}
        aria-invalid={currentState === 'error' || undefined}
        aria-describedby={messageId}
        className={[
          styles.input,
          styles[size],
          currentState === 'error' ? styles.error : '',
          currentState === 'warning' ? styles.warning : '',
          className ?? '',
        ]
          .join(' ')
          .trim()}
      />
      {message ? (
        <p
          id={messageId}
          className={[
            styles.message,
            currentState === 'error' ? styles.messageError : '',
            currentState === 'warning' ? styles.messageWarning : '',
          ]
            .join(' ')
            .trim()}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
