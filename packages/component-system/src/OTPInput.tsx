import {
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import styles from './OTPInput.module.css';

export interface OTPInputProps {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  inputMode?: 'numeric' | 'text';
  autoFocus?: boolean;
  ariaLabel?: string;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  label,
  helperText,
  error,
  disabled,
  inputMode = 'numeric',
  autoFocus,
  ariaLabel,
}: OTPInputProps) {
  const fallbackId = useId();
  const baseId = `rf-otp-${fallbackId}`;
  const [internalValue, setInternalValue] = useState('');
  const isControlled = value !== undefined;
  const resolvedValue = value ?? internalValue;

  const digits = useMemo(() => {
    const sanitized = resolvedValue.replace(/\s/g, '');
    return Array.from({ length }, (_, index) => sanitized[index] ?? '');
  }, [resolvedValue, length]);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const updateValue = (nextDigits: string[], moveFocusTo?: number) => {
    const nextValue = nextDigits.join('');
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
    if (nextValue.length === length && !nextDigits.includes('')) {
      onComplete?.(nextValue);
    }
    if (typeof moveFocusTo === 'number') {
      inputRefs.current[moveFocusTo]?.focus();
    }
  };

  const handleInputChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const lastChar = raw.slice(-1);
    const nextChar = inputMode === 'numeric' ? lastChar.replace(/\D/g, '') : lastChar;
    const nextDigits = [...digits];

    if (!nextChar) {
      nextDigits[index] = '';
      for (let i = index + 1; i < length; i += 1) {
        nextDigits[i] = '';
      }
      updateValue(nextDigits);
      return;
    }

    nextDigits[index] = nextChar;
    updateValue(nextDigits, Math.min(index + 1, length - 1));
  };

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      if (digits[index]) {
        const nextDigits = [...digits];
        nextDigits[index] = '';
        for (let i = index + 1; i < length; i += 1) {
          nextDigits[i] = '';
        }
        updateValue(nextDigits, index);
      } else if (index > 0) {
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        for (let i = index; i < length; i += 1) {
          nextDigits[i] = '';
        }
        updateValue(nextDigits, index - 1);
      }
      event.preventDefault();
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      event.preventDefault();
    }

    if (event.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      event.preventDefault();
    }
  };

  const handlePaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    const clipboard = event.clipboardData.getData('text');
    if (!clipboard) return;

    const filtered = inputMode === 'numeric' ? clipboard.replace(/\D/g, '') : clipboard;
    if (!filtered) return;

    const nextDigits = [...digits];
    let writeIndex = index;
    for (const char of filtered) {
      if (writeIndex >= length) break;
      nextDigits[writeIndex] = char;
      writeIndex += 1;
    }

    updateValue(nextDigits, Math.min(writeIndex, length - 1));
    event.preventDefault();
  };

  const message = error ?? helperText;
  const messageId = message ? `${baseId}-message` : undefined;

  return (
    <div className={styles.field} role="group" aria-label={ariaLabel ?? label ?? 'One-time password'}>
      {label ? (
        <label className={styles.label} htmlFor={`${baseId}-0`}>
          {label}
        </label>
      ) : null}
      <div className={styles.inputRow}>
        {digits.map((digit, index) => (
          <input
            key={`${baseId}-${index}`}
            id={`${baseId}-${index}`}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            className={styles.digitInput}
            value={digit}
            onChange={handleInputChange(index)}
            onKeyDown={handleKeyDown(index)}
            onPaste={handlePaste(index)}
            inputMode={inputMode}
            pattern={inputMode === 'numeric' ? '[0-9]*' : undefined}
            type="text"
            maxLength={1}
            autoComplete="one-time-code"
            aria-label={`Digit ${index + 1} of ${length}`}
            aria-describedby={messageId}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
          />
        ))}
      </div>
      {message ? (
        <p className={[styles.message, error ? styles.messageError : ''].join(' ').trim()} id={messageId}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
