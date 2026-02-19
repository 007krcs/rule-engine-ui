import { useEffect, useMemo, useState, type ChangeEvent, type FocusEvent } from 'react';
import { Input, type InputProps } from './Input';

export interface DatePickerProps extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
  selectedDate?: Date | string | null;
  onDateChange?: (date: Date | null, meta: { value: string; isValid: boolean }) => void;
  locale?: string;
  dateFormat?: string;
  useNative?: boolean;
  minDate?: Date | string;
  maxDate?: Date | string;
  ariaLabel?: string;
}

export function DatePicker({
  selectedDate,
  onDateChange,
  locale,
  dateFormat,
  useNative = true,
  minDate,
  maxDate,
  ariaLabel,
  onFocus,
  onBlur,
  ...rest
}: DatePickerProps) {
  const resolvedLocale = useMemo(() => {
    const trimmed = locale?.trim();
    if (trimmed) return trimmed;
    return typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  }, [locale]);

  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const resolvedDate = useMemo(() => {
    if (!selectedDate) return null;
    if (selectedDate instanceof Date) return isValidDate(selectedDate) ? selectedDate : null;
    if (typeof selectedDate === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        const isoDate = new Date(`${selectedDate}T00:00:00`);
        return isValidDate(isoDate) ? isoDate : null;
      }
      const parsed = parseDateValue(selectedDate, resolvedLocale, dateFormat);
      return parsed.date;
    }
    return null;
  }, [selectedDate, resolvedLocale, dateFormat]);

  useEffect(() => {
    if (isFocused) return;
    if (!resolvedDate) {
      setDisplayValue('');
      return;
    }

    if (useNative) {
      setDisplayValue(formatIsoDate(resolvedDate));
    } else {
      setDisplayValue(formatDateValue(resolvedDate, resolvedLocale, dateFormat));
    }
  }, [resolvedDate, resolvedLocale, dateFormat, useNative, isFocused]);

  const min = useNative ? toNativeDateBoundary(minDate) : undefined;
  const max = useNative ? toNativeDateBoundary(maxDate) : undefined;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDisplayValue(nextValue);
    const parsed = useNative
      ? parseNativeDate(nextValue)
      : parseDateValue(nextValue, resolvedLocale, dateFormat);
    onDateChange?.(parsed.date, { value: nextValue, isValid: parsed.isValid });
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const nextValue = event.target.value;
    const parsed = useNative
      ? parseNativeDate(nextValue)
      : parseDateValue(nextValue, resolvedLocale, dateFormat);
    if (parsed.date && !useNative) {
      setDisplayValue(formatDateValue(parsed.date, resolvedLocale, dateFormat));
    }
    onDateChange?.(parsed.date, { value: nextValue, isValid: parsed.isValid });
    onBlur?.(event);
  };

  return (
    <Input
      {...rest}
      type={useNative ? 'date' : 'text'}
      value={displayValue}
      min={min}
      max={max}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      aria-label={ariaLabel}
      placeholder={useNative ? rest.placeholder : rest.placeholder ?? dateFormat ?? undefined}
    />
  );
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toNativeDateBoundary(value?: Date | string): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date && isValidDate(value)) return formatIsoDate(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return isValidDate(parsed) ? formatIsoDate(parsed) : undefined;
}

function parseNativeDate(value: string): { date: Date | null; isValid: boolean } {
  if (!value) return { date: null, isValid: true };
  const parsed = new Date(`${value}T00:00:00`);
  if (!isValidDate(parsed)) return { date: null, isValid: false };
  return { date: parsed, isValid: true };
}

function parseDateValue(
  value: string,
  locale: string,
  dateFormat?: string,
): { date: Date | null; isValid: boolean } {
  if (!value) return { date: null, isValid: true };

  if (dateFormat) {
    const parsed = parseDateByPattern(value, dateFormat);
    if (parsed) return { date: parsed, isValid: true };
  }

  const parsed = parseDateByLocale(value, locale);
  if (!parsed) return { date: null, isValid: false };
  return { date: parsed, isValid: true };
}

function parseDateByLocale(value: string, locale: string): Date | null {
  const order = getLocaleOrder(locale);
  const tokens = value.trim().split(/\D+/).filter(Boolean);
  if (tokens.length < 3) return null;

  const values: Record<'year' | 'month' | 'day', number> = {
    year: 0,
    month: 0,
    day: 0,
  };

  for (let index = 0; index < order.length; index += 1) {
    const part = order[index];
    const token = tokens[index];
    if (!part || !token) return null;
    values[part] = Number(token);
  }

  return createSafeDate(values.year, values.month, values.day);
}

function parseDateByPattern(value: string, pattern: string): Date | null {
  const tokenRegex = /(yyyy|yy|MM|M|dd|d)/g;
  const tokens: Array<'year' | 'month' | 'day'> = [];
  const regexSource = `^${pattern.replace(tokenRegex, (match) => {
    if (match.includes('y')) tokens.push('year');
    if (match.includes('M')) tokens.push('month');
    if (match.includes('d')) tokens.push('day');
    switch (match) {
      case 'yyyy':
        return '(\\d{4})';
      case 'yy':
        return '(\\d{2})';
      case 'MM':
        return '(\\d{2})';
      case 'M':
        return '(\\d{1,2})';
      case 'dd':
        return '(\\d{2})';
      case 'd':
        return '(\\d{1,2})';
      default:
        return '(\\d{1,2})';
    }
  })}$`;

  const regex = new RegExp(regexSource);
  const match = regex.exec(value.trim());
  if (!match) return null;

  const values: Record<'year' | 'month' | 'day', number> = {
    year: 0,
    month: 0,
    day: 0,
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const raw = match[index + 1];
    if (!token || !raw) return null;
    values[token] = Number(raw);
  }

  return createSafeDate(values.year, values.month, values.day);
}

function formatDateValue(date: Date, locale: string, dateFormat?: string): string {
  if (dateFormat) {
    return formatDateByPattern(date, dateFormat);
  }
  const safeLocale = resolveLocale(locale);
  return new Intl.DateTimeFormat(safeLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatDateByPattern(date: Date, pattern: string): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return pattern
    .replace(/yyyy/g, `${year}`)
    .replace(/yy/g, `${year}`.slice(-2))
    .replace(/MM/g, `${month}`.padStart(2, '0'))
    .replace(/dd/g, `${day}`.padStart(2, '0'))
    .replace(/M/g, `${month}`)
    .replace(/d/g, `${day}`);
}

function getLocaleOrder(locale: string): Array<'month' | 'day' | 'year'> {
  const safeLocale = resolveLocale(locale);
  const parts = new Intl.DateTimeFormat(safeLocale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(2000, 11, 31));
  const order: Array<'month' | 'day' | 'year'> = [];
  for (const part of parts) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      order.push(part.type);
    }
  }
  return order.length === 3 ? order : ['month', 'day', 'year'];
}

function createSafeDate(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const normalizedYear = year < 100 ? (year >= 70 ? 1900 + year : 2000 + year) : year;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(normalizedYear, month - 1, day);
  if (!isValidDate(date)) return null;
  if (
    date.getFullYear() !== normalizedYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

function resolveLocale(locale: string): string {
  try {
    new Intl.DateTimeFormat(locale);
    return locale;
  } catch {
    return 'en-US';
  }
}
