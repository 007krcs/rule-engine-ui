import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import styles from './Checkbox.module.css';

export type CheckboxState = 'default' | 'error' | 'warning';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  warning?: ReactNode;
  state?: CheckboxState;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    id,
    label,
    helperText,
    error,
    warning,
    state = 'default',
    indeterminate = false,
    className,
    ...rest
  },
  ref,
) {
  const fallbackId = useId();
  const resolvedId = id ?? `rf-checkbox-${fallbackId}`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  const currentState = error ? 'error' : warning ? 'warning' : state;
  const message = error ?? warning ?? helperText;
  const messageId = message ? `${resolvedId}-message` : undefined;

  return (
    <div className={styles.field}>
      <label className={styles.control} htmlFor={resolvedId}>
        <input
          {...rest}
          id={resolvedId}
          ref={inputRef}
          type="checkbox"
          aria-invalid={currentState === 'error' || undefined}
          aria-describedby={messageId}
          className={[styles.input, className ?? ''].join(' ').trim()}
        />
        <span className={styles.box} aria-hidden="true" />
        {label ? <span className={styles.labelText}>{label}</span> : null}
      </label>
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
});
