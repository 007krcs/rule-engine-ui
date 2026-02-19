import { useEffect, useMemo, useState, type ChangeEvent, type FocusEvent } from 'react';
import { Input, type InputProps } from './Input';

const IBAN_LENGTHS: Record<string, number> = {
  AL: 28,
  AD: 24,
  AT: 20,
  AZ: 28,
  BH: 22,
  BE: 16,
  BA: 20,
  BR: 29,
  BG: 22,
  CR: 22,
  HR: 21,
  CY: 28,
  CZ: 24,
  DK: 18,
  DO: 28,
  EE: 20,
  FI: 18,
  FR: 27,
  GE: 22,
  DE: 22,
  GI: 23,
  GR: 27,
  GT: 28,
  HU: 28,
  IS: 26,
  IE: 22,
  IL: 23,
  IT: 27,
  JO: 30,
  KZ: 20,
  KW: 30,
  LV: 21,
  LB: 28,
  LI: 21,
  LT: 20,
  LU: 20,
  MK: 19,
  MT: 31,
  MR: 27,
  MU: 30,
  MC: 27,
  MD: 24,
  ME: 22,
  NL: 18,
  NO: 15,
  PK: 24,
  PL: 28,
  PT: 25,
  QA: 29,
  RO: 24,
  SM: 27,
  SA: 24,
  RS: 22,
  SK: 24,
  SI: 19,
  ES: 24,
  SE: 24,
  CH: 21,
  TN: 24,
  TR: 26,
  AE: 23,
  GB: 22,
  VG: 24,
};

export interface IBANInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value?: string;
  onValueChange?: (value: string, meta: { isValid: boolean | null }) => void;
  countryCode?: string;
  validateOnBlur?: boolean;
  ariaLabel?: string;
}

export function IBANInput({
  value,
  onValueChange,
  countryCode,
  validateOnBlur = true,
  ariaLabel,
  onBlur,
  onFocus,
  ...rest
}: IBANInputProps) {
  const [internalValue, setInternalValue] = useState('');
  const [showError, setShowError] = useState(false);
  const isControlled = value !== undefined;
  const rawValue = value ?? internalValue;

  const formattedValue = useMemo(() => formatIban(rawValue), [rawValue]);
  const validation = useMemo(() => validateIban(rawValue, countryCode), [rawValue, countryCode]);

  useEffect(() => {
    if (!isControlled) return;
    setInternalValue(value ?? '');
  }, [isControlled, value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextRaw = sanitizeIban(event.target.value, countryCode);
    if (!isControlled) {
      setInternalValue(nextRaw);
    }
    setShowError(false);
    onValueChange?.(nextRaw, { isValid: validateIban(nextRaw, countryCode) });
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (validateOnBlur && validation === false) {
      setShowError(true);
    }
    onBlur?.(event);
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setShowError(false);
    onFocus?.(event);
  };

  return (
    <Input
      {...rest}
      type="text"
      value={formattedValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      error={showError ? 'Invalid IBAN' : rest.error}
      inputMode="text"
      autoComplete="off"
      aria-label={ariaLabel}
    />
  );
}

function sanitizeIban(value: string, countryCode?: string): string {
  const stripped = value.replace(/\s+/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const length = getIbanLength(countryCode ?? stripped.slice(0, 2));
  return length ? stripped.slice(0, length) : stripped;
}

function formatIban(value: string): string {
  const cleaned = value.replace(/\s+/g, '').toUpperCase();
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

function validateIban(value: string, countryCode?: string): boolean | null {
  const stripped = value.replace(/\s+/g, '').toUpperCase();
  if (!stripped) return null;
  if (stripped.length < 4) return null;

  const country = countryCode ?? stripped.slice(0, 2);
  const expectedLength = getIbanLength(country);
  if (expectedLength && stripped.length < expectedLength) return null;
  if (expectedLength && stripped.length !== expectedLength) return false;

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(stripped)) return false;

  const rearranged = stripped.slice(4) + stripped.slice(0, 4);
  const remainder = ibanMod97(rearranged);
  return remainder === 1;
}

function getIbanLength(countryCode?: string): number | undefined {
  if (!countryCode) return undefined;
  return IBAN_LENGTHS[countryCode.toUpperCase()];
}

function ibanMod97(value: string): number {
  let remainder = 0;
  for (const char of value) {
    if (/[0-9]/.test(char)) {
      remainder = (remainder * 10 + Number(char)) % 97;
    } else {
      const numeric = char.charCodeAt(0) - 55;
      const digits = String(numeric);
      for (const digit of digits) {
        remainder = (remainder * 10 + Number(digit)) % 97;
      }
    }
  }
  return remainder;
}
