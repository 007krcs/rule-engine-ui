import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

export type SelectSize = 'sm' | 'md' | 'lg';
export type SelectState = 'default' | 'error' | 'warning';

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  warning?: ReactNode;
  size?: SelectSize;
  state?: SelectState;
  options?: SelectOption[];
  placeholder?: ReactNode;
}

export function Select({
  id,
  label,
  helperText,
  error,
  warning,
  size = 'md',
  state = 'default',
  options,
  placeholder,
  className,
  children,
  ...rest
}: SelectProps) {
  const fallbackId = useId();
  const resolvedId = id ?? `rf-select-${fallbackId}`;

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
      <div className={styles.controlWrap}>
        <select
          {...rest}
          id={resolvedId}
          aria-invalid={currentState === 'error' || undefined}
          aria-describedby={messageId}
          className={[
            styles.select,
            styles[size],
            currentState === 'error' ? styles.error : '',
            currentState === 'warning' ? styles.warning : '',
            className ?? '',
          ]
            .join(' ')
            .trim()}
        >
          {placeholder ? (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          ) : null}
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <span className={styles.caret} aria-hidden="true">
          v
        </span>
      </div>
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
