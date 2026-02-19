import {
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import styles from './Radio.module.css';

export type RadioState = 'default' | 'error' | 'warning';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  warning?: ReactNode;
  state?: RadioState;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { id, label, helperText, error, warning, state = 'default', className, ...rest },
  ref,
) {
  const fallbackId = useId();
  const resolvedId = id ?? `rf-radio-${fallbackId}`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

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
          type="radio"
          aria-invalid={currentState === 'error' || undefined}
          aria-describedby={messageId}
          className={[styles.input, className ?? ''].join(' ').trim()}
        />
        <span className={styles.dot} aria-hidden="true" />
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
