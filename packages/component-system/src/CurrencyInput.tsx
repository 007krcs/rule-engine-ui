import { useEffect, useMemo, useState, type ChangeEvent, type FocusEvent } from 'react';
import { Input, type InputProps } from './Input';

export interface CurrencyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value?: number | string | null;
  onValueChange?: (value: number | null, meta: { raw: string }) => void;
  locale?: string;
  currency?: string;
  fractionDigits?: number;
  ariaLabel?: string;
}

export function CurrencyInput({
  value,
  onValueChange,
  locale,
  currency,
  fractionDigits,
  ariaLabel,
  onFocus,
  onBlur,
  ...rest
}: CurrencyInputProps) {
  const resolvedLocale = useMemo(() => {
    const trimmed = locale?.trim();
    if (trimmed) return trimmed;
    return typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  }, [locale]);

  const numericValue = useMemo(() => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = parseLocaleNumber(String(value), resolvedLocale);
    return parsed;
  }, [value, resolvedLocale]);

  const formattedValue = useMemo(() => {
    if (numericValue === null) return '';
    return formatCurrencyValue(numericValue, resolvedLocale, currency, fractionDigits);
  }, [numericValue, resolvedLocale, currency, fractionDigits]);

  const [isFocused, setIsFocused] = useState(false);
  const [draftValue, setDraftValue] = useState('');

  useEffect(() => {
    if (isFocused) return;
    setDraftValue(numericValue === null ? '' : String(numericValue));
  }, [numericValue, isFocused]);

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setDraftValue(numericValue === null ? '' : String(numericValue));
    onFocus?.(event);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextRaw = event.target.value;
    setDraftValue(nextRaw);
    const parsed = parseLocaleNumber(nextRaw, resolvedLocale);
    onValueChange?.(parsed, { raw: nextRaw });
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const parsed = parseLocaleNumber(draftValue, resolvedLocale);
    onValueChange?.(parsed, { raw: draftValue });
    onBlur?.(event);
  };

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={isFocused ? draftValue : formattedValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      aria-label={ariaLabel}
    />
  );
}

export function formatCurrencyValue(
  value: number,
  locale: string,
  currency?: string,
  fractionDigits?: number,
): string {
  const safeLocale = resolveLocale(locale);
  const options: Intl.NumberFormatOptions = currency
    ? { style: 'currency', currency }
    : { style: 'decimal' };
  if (typeof fractionDigits === 'number') {
    options.minimumFractionDigits = fractionDigits;
    options.maximumFractionDigits = fractionDigits;
  }
  return new Intl.NumberFormat(safeLocale, options).format(value);
}

export function parseLocaleNumber(value: string, locale: string): number | null {
  if (!value) return null;
  const { group, decimal } = getSeparators(locale);
  let normalized = value
    .replace(/\s/g, '')
    .replace(new RegExp(escapeRegExp(group), 'g'), '')
    .replace(new RegExp(`[^0-9${escapeRegExp(decimal)}-]`, 'g'), '');

  if (decimal !== '.') {
    normalized = normalized.replace(decimal, '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSeparators(locale: string): { group: string; decimal: string } {
  const safeLocale = resolveLocale(locale);
  const parts = new Intl.NumberFormat(safeLocale).formatToParts(12345.6);
  const group = parts.find((part) => part.type === 'group')?.value ?? ',';
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.';
  return { group, decimal };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveLocale(locale: string): string {
  try {
    new Intl.NumberFormat(locale);
    return locale;
  } catch {
    return 'en-US';
  }
}
