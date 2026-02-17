import type {
  ChangeEvent,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn, sizeClass, type PFBaseProps } from './utils';

type FieldVariant = 'outline' | 'filled' | 'ghost';

export type PFFormLabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function PFFormLabel({ className, ...rest }: PFFormLabelProps) {
  return <label className={cn('pf-form-label', className)} {...rest} />;
}

export interface PFFormHelperTextProps extends HTMLAttributes<HTMLParagraphElement> {
  error?: boolean;
}

export function PFFormHelperText({ className, error = false, ...rest }: PFFormHelperTextProps) {
  return <p className={cn('pf-form-helper', error && 'is-error', className)} {...rest} />;
}

export interface PFInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    PFBaseProps {
  variant?: FieldVariant;
  loading?: boolean;
}

export function PFInput({
  className,
  size = 'md',
  variant = 'outline',
  loading = false,
  disabled,
  ...rest
}: PFInputProps) {
  const isDisabled = disabled || loading;
  return (
    <span className={cn('pf-field-wrap', loading && 'is-loading')}>
      <input
        {...rest}
        className={cn('pf-input', sizeClass(size), `pf-input--${variant}`, className)}
        disabled={isDisabled}
        aria-busy={loading || undefined}
      />
      {loading ? <span className="pf-spinner pf-field-wrap__spinner" aria-hidden="true" /> : null}
    </span>
  );
}

export interface PFTextFieldProps extends Omit<PFInputProps, 'children'> {
  id: string;
  label?: ReactNode;
  helperText?: ReactNode;
  error?: boolean;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
}

export function PFTextField({
  id,
  label,
  helperText,
  error = false,
  startAdornment,
  endAdornment,
  className,
  ...rest
}: PFTextFieldProps) {
  const describedBy = helperText ? `${id}-helper` : undefined;
  return (
    <div className={cn('pf-text-field', className)}>
      {label ? <PFFormLabel htmlFor={id}>{label}</PFFormLabel> : null}
      <span
        className={cn(
          'pf-text-field__control',
          Boolean(startAdornment) && 'pf-text-field__control--start',
          Boolean(endAdornment) && 'pf-text-field__control--end',
        )}
      >
        {startAdornment ? <span className="pf-text-field__adornment pf-text-field__adornment--start">{startAdornment}</span> : null}
        <PFInput id={id} aria-invalid={error || undefined} aria-describedby={describedBy} {...rest} />
        {endAdornment ? <span className="pf-text-field__adornment pf-text-field__adornment--end">{endAdornment}</span> : null}
      </span>
      {helperText ? (
        <PFFormHelperText id={describedBy} error={error}>
          {helperText}
        </PFFormHelperText>
      ) : null}
    </div>
  );
}

export interface PFTextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
    PFBaseProps {
  variant?: FieldVariant;
}

export function PFTextArea({
  className,
  size = 'md',
  variant = 'outline',
  ...rest
}: PFTextAreaProps) {
  return <textarea className={cn('pf-textarea', sizeClass(size), `pf-textarea--${variant}`, className)} {...rest} />;
}

export interface PFSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface PFSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    PFBaseProps {
  variant?: FieldVariant;
  options: PFSelectOption[];
  loading?: boolean;
  placeholder?: string;
}

export function PFSelect({
  className,
  size = 'md',
  variant = 'outline',
  options,
  placeholder,
  loading = false,
  disabled,
  value,
  ...rest
}: PFSelectProps) {
  const isDisabled = disabled || loading;
  const normalizedValue = value ?? '';
  return (
    <span className={cn('pf-field-wrap', loading && 'is-loading')}>
      <select
        {...rest}
        value={normalizedValue}
        className={cn('pf-select', sizeClass(size), `pf-select--${variant}`, className)}
        disabled={isDisabled}
        aria-busy={loading || undefined}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="pf-select__chevron" aria-hidden="true">
        v
      </span>
      {loading ? <span className="pf-spinner pf-field-wrap__spinner" aria-hidden="true" /> : null}
    </span>
  );
}

export interface PFCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'>,
    PFBaseProps {
  label?: ReactNode;
  helperText?: ReactNode;
}

export function PFCheckbox({
  className,
  size = 'md',
  label,
  helperText,
  id,
  ...rest
}: PFCheckboxProps) {
  return (
    <label className={cn('pf-choice', sizeClass(size), className)} htmlFor={id}>
      <input {...rest} id={id} type="checkbox" className="pf-choice__control" />
      <span className="pf-choice__text">
        {label ? <span className="pf-choice__label">{label}</span> : null}
        {helperText ? <span className="pf-choice__helper">{helperText}</span> : null}
      </span>
    </label>
  );
}

export interface PFRadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'>,
    PFBaseProps {
  label?: ReactNode;
  helperText?: ReactNode;
}

export function PFRadio({
  className,
  size = 'md',
  label,
  helperText,
  id,
  ...rest
}: PFRadioProps) {
  return (
    <label className={cn('pf-choice', 'pf-choice--radio', sizeClass(size), className)} htmlFor={id}>
      <input {...rest} id={id} type="radio" className="pf-choice__control" />
      <span className="pf-choice__text">
        {label ? <span className="pf-choice__label">{label}</span> : null}
        {helperText ? <span className="pf-choice__helper">{helperText}</span> : null}
      </span>
    </label>
  );
}

export interface PFSwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'>,
    PFBaseProps {
  label?: ReactNode;
  onCheckedChange?: (checked: boolean) => void;
}

export function PFSwitch({
  className,
  size = 'md',
  label,
  checked,
  onChange,
  onCheckedChange,
  id,
  ...rest
}: PFSwitchProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange?.(event);
    onCheckedChange?.(event.target.checked);
  };

  return (
    <label className={cn('pf-switch', sizeClass(size), className)} htmlFor={id}>
      <input
        {...rest}
        id={id}
        type="checkbox"
        className="pf-switch__input"
        role="switch"
        checked={checked}
        onChange={handleChange}
      />
      <span className="pf-switch__track" aria-hidden="true">
        <span className="pf-switch__thumb" />
      </span>
      {label ? <span className="pf-switch__label">{label}</span> : null}
    </label>
  );
}

export interface PFSliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'>,
    PFBaseProps {
  showValue?: boolean;
}

export function PFSlider({
  className,
  size = 'md',
  min = 0,
  max = 100,
  showValue = true,
  value,
  ...rest
}: PFSliderProps) {
  const resolvedValue =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) || min : min;
  return (
    <div className={cn('pf-slider-wrap', sizeClass(size), className)}>
      <input {...rest} className="pf-slider" type="range" min={min} max={max} value={value} />
      {showValue ? (
        <output className="pf-slider__value" aria-live="polite">
          {resolvedValue}
        </output>
      ) : null}
    </div>
  );
}

export interface PFAutocompleteOption {
  value: string;
  label?: string;
  disabled?: boolean;
}

export interface PFAutocompleteProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    PFBaseProps {
  options?: PFAutocompleteOption[];
  variant?: FieldVariant;
  loading?: boolean;
  loadOptions?: (query: string) => Promise<PFAutocompleteOption[]>;
  debounceMs?: number;
  noOptionsText?: string;
  loadingText?: string;
  onValueChange?: (value: string, option: PFAutocompleteOption) => void;
  openOnFocus?: boolean;
  filterStaticOptions?: boolean;
}

export function PFAutocomplete({
  className,
  size = 'md',
  options = [],
  variant = 'outline',
  id,
  loading = false,
  loadOptions,
  debounceMs = 240,
  noOptionsText = 'No matches',
  loadingText = 'Loading...',
  onValueChange,
  openOnFocus = true,
  filterStaticOptions = true,
  disabled,
  value,
  defaultValue,
  onChange,
  onFocus,
  onKeyDown,
  ...rest
}: PFAutocompleteProps) {
  const generatedId = useId();
  const inputId = id ?? `pf-autocomplete-${generatedId}`;
  const listId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const isControlled = typeof value === 'string';
  const [internalValue, setInternalValue] = useState<string>(() =>
    typeof defaultValue === 'string' ? defaultValue : '',
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [asyncOptions, setAsyncOptions] = useState<PFAutocompleteOption[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);

  const inputValue = isControlled ? value : internalValue;
  const query = typeof inputValue === 'string' ? inputValue : '';
  const isBusy = loading || asyncLoading;

  useEffect(() => {
    if (!loadOptions) return;
    const currentRequest = requestRef.current + 1;
    requestRef.current = currentRequest;

    const timeout = window.setTimeout(() => {
      setAsyncLoading(true);
      loadOptions(query)
        .then((result) => {
          if (requestRef.current !== currentRequest) return;
          setAsyncOptions(Array.isArray(result) ? result : []);
        })
        .catch(() => {
          if (requestRef.current !== currentRequest) return;
          setAsyncOptions([]);
        })
        .finally(() => {
          if (requestRef.current !== currentRequest) return;
          setAsyncLoading(false);
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [debounceMs, loadOptions, query]);

  useEffect(() => {
    const handleClickAway = (event: MouseEvent): void => {
      if (!rootRef.current) return;
      if (event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, []);

  const sourceOptions = loadOptions ? asyncOptions : options;
  const visibleOptions = useMemo(() => {
    if (!filterStaticOptions || loadOptions) return sourceOptions;
    const needle = query.trim().toLowerCase();
    if (!needle) return sourceOptions;
    return sourceOptions.filter((option) => {
      const label = (option.label ?? option.value).toLowerCase();
      return label.includes(needle);
    });
  }, [filterStaticOptions, loadOptions, query, sourceOptions]);

  const selectOption = (option: PFAutocompleteOption): void => {
    if (disabled || option.disabled) return;
    const nextValue = option.label ?? option.value;
    if (!isControlled) setInternalValue(nextValue);
    onValueChange?.(nextValue, option);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const moveActive = (offset: 1 | -1): void => {
    if (visibleOptions.length === 0) return;
    let candidate = activeIndex;
    for (let step = 0; step < visibleOptions.length; step += 1) {
      candidate = (candidate + offset + visibleOptions.length) % visibleOptions.length;
      if (!visibleOptions[candidate]?.disabled) {
        setActiveIndex(candidate);
        return;
      }
    }
  };

  return (
    <div className={cn('pf-autocomplete', className)} ref={rootRef}>
      <span className={cn('pf-field-wrap', isBusy && 'is-loading')}>
      <input
        {...rest}
        id={inputId}
        autoComplete="off"
        value={typeof inputValue === 'string' ? inputValue : ''}
        onChange={(event) => {
          if (!isControlled) setInternalValue(event.target.value);
          onChange?.(event);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={(event) => {
          if (openOnFocus && !disabled) setIsOpen(true);
          onFocus?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!isOpen) setIsOpen(true);
            moveActive(1);
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) setIsOpen(true);
            moveActive(-1);
            return;
          }
          if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
            event.preventDefault();
            const option = visibleOptions[activeIndex];
            if (option) selectOption(option);
            return;
          }
          if (event.key === 'Escape') {
            setIsOpen(false);
            setActiveIndex(-1);
            return;
          }
          onKeyDown?.(event);
        }}
        disabled={disabled}
        className={cn('pf-input', sizeClass(size), `pf-input--${variant}`, 'pf-autocomplete__input')}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
        aria-busy={isBusy || undefined}
        aria-disabled={disabled || undefined}
      />
      {isBusy ? <span className="pf-spinner pf-field-wrap__spinner" aria-hidden="true" /> : null}
    </span>
      {isOpen ? (
        <ul className={cn('pf-autocomplete__list', sizeClass(size))} id={listId} role="listbox">
          {visibleOptions.length === 0 ? (
            <li className="pf-autocomplete__empty" aria-live="polite">
              {isBusy ? loadingText : noOptionsText}
            </li>
          ) : (
            visibleOptions.map((option, index) => {
              const optionId = `${listId}-option-${index}`;
              const selected = activeIndex === index;
              return (
                <li
                  key={`${option.value}-${index}`}
                  id={optionId}
                  className={cn(
                    'pf-autocomplete__option',
                    selected && 'is-active',
                    option.disabled && 'is-disabled',
                  )}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={option.disabled || undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  {option.label ?? option.value}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function normalizeIsoDate(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (ISO_DATE_PATTERN.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function normalizeTime(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (TIME_PATTERN.test(trimmed)) return trimmed;
  return '';
}

function normalizeDateTimeInput(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  const hh = String(parsed.getHours()).padStart(2, '0');
  const min = String(parsed.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function formatDatePreview(
  isoDate: string,
  locale: string,
  timezone: string | undefined,
  displayFormat: 'short' | 'medium' | 'long' | Intl.DateTimeFormatOptions,
): string {
  if (!ISO_DATE_PATTERN.test(isoDate)) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const options =
    typeof displayFormat === 'string'
      ? displayFormat === 'short'
        ? ({ month: 'short', day: '2-digit', year: 'numeric', timeZone: timezone } as Intl.DateTimeFormatOptions)
        : displayFormat === 'long'
          ? ({ month: 'long', day: '2-digit', year: 'numeric', weekday: 'short', timeZone: timezone } as Intl.DateTimeFormatOptions)
          : ({ month: 'short', day: '2-digit', year: 'numeric', timeZone: timezone } as Intl.DateTimeFormatOptions)
      : { ...displayFormat, timeZone: timezone ?? displayFormat.timeZone };
  return new Intl.DateTimeFormat(locale, options).format(date);
}

function toIsoDateFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toIsoDateTime(value: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}

export interface PFDateFieldProps extends Omit<PFTextFieldProps, 'type' | 'value'> {
  value?: string;
  minDate?: string;
  maxDate?: string;
  locale?: string;
  timezone?: string;
  displayFormat?: 'short' | 'medium' | 'long' | Intl.DateTimeFormatOptions;
  onValueChange?: (value: string) => void;
}

export function PFDateField({
  value,
  minDate,
  maxDate,
  helperText,
  locale = 'en-US',
  timezone,
  displayFormat = 'medium',
  onValueChange,
  onChange,
  ...rest
}: PFDateFieldProps) {
  const isoValue = normalizeIsoDate(value);
  const preview = isoValue ? formatDatePreview(isoValue, locale, timezone, displayFormat) : '';
  const nextHelper =
    helperText && preview ? (
      <>
        {helperText}
        <span className="pf-date-field__preview">Displayed as {preview}</span>
      </>
    ) : preview ? (
      <span className="pf-date-field__preview">Displayed as {preview}</span>
    ) : (
      helperText
    );

  return (
    <PFTextField
      {...rest}
      type="date"
      value={isoValue}
      min={normalizeIsoDate(minDate) || undefined}
      max={normalizeIsoDate(maxDate) || undefined}
      helperText={nextHelper}
      onChange={(event) => {
        onChange?.(event);
        onValueChange?.(normalizeIsoDate(event.target.value));
      }}
    />
  );
}

export interface PFTimeFieldProps extends Omit<PFTextFieldProps, 'type' | 'value'> {
  value?: string;
  minTime?: string;
  maxTime?: string;
  step?: number;
  onValueChange?: (value: string) => void;
}

export function PFTimeField({
  value,
  minTime,
  maxTime,
  step = 60,
  onValueChange,
  onChange,
  ...rest
}: PFTimeFieldProps) {
  return (
    <PFTextField
      {...rest}
      type="time"
      value={normalizeTime(value)}
      min={normalizeTime(minTime) || undefined}
      max={normalizeTime(maxTime) || undefined}
      step={step}
      onChange={(event) => {
        onChange?.(event);
        onValueChange?.(normalizeTime(event.target.value));
      }}
    />
  );
}

export interface PFDateTimeFieldProps extends Omit<PFTextFieldProps, 'type' | 'value'> {
  value?: string;
  minDateTime?: string;
  maxDateTime?: string;
  step?: number;
  onValueChange?: (value: string) => void;
}

export function PFDateTimeField({
  value,
  minDateTime,
  maxDateTime,
  step = 60,
  onValueChange,
  onChange,
  ...rest
}: PFDateTimeFieldProps) {
  return (
    <PFTextField
      {...rest}
      type="datetime-local"
      value={normalizeDateTimeInput(value)}
      min={normalizeDateTimeInput(minDateTime) || undefined}
      max={normalizeDateTimeInput(maxDateTime) || undefined}
      step={step}
      onChange={(event) => {
        onChange?.(event);
        onValueChange?.(toIsoDateTime(event.target.value));
      }}
    />
  );
}

export interface PFCalendarProps extends HTMLAttributes<HTMLDivElement>, PFBaseProps {
  value?: string;
  minDate?: string;
  maxDate?: string;
  locale?: string;
  timezone?: string;
  disabledDates?: string[] | ((isoDate: string) => boolean);
  onValueChange?: (value: string) => void;
}

export function PFCalendar({
  className,
  value,
  minDate,
  maxDate,
  locale = 'en-US',
  timezone,
  disabledDates,
  onValueChange,
  ...rest
}: PFCalendarProps) {
  const selected = normalizeIsoDate(value);
  const now = new Date();
  const initial = selected ? new Date(`${selected}T00:00:00`) : now;
  const [cursor, setCursor] = useState(() => ({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  }));
  const rootRef = useRef<HTMLDivElement>(null);
  const minValue = normalizeIsoDate(minDate);
  const maxValue = normalizeIsoDate(maxDate);

  const monthDate = useMemo(() => new Date(cursor.year, cursor.month, 1), [cursor.month, cursor.year]);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const firstWeekday = monthDate.getDay();
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: timezone });
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(2026, 0, 4 + index);
      return formatter.format(date);
    });
  }, [locale, timezone]);

  useEffect(() => {
    if (!selected) return;
    const next = new Date(`${selected}T00:00:00`);
    if (Number.isNaN(next.getTime())) return;
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }, [selected]);

  const isDisabled = (isoDate: string) => {
    if (minValue && isoDate < minValue) return true;
    if (maxValue && isoDate > maxValue) return true;
    if (Array.isArray(disabledDates)) return disabledDates.includes(isoDate);
    if (typeof disabledDates === 'function') return disabledDates(isoDate);
    return false;
  };

  const focusDateButton = (isoDate: string) => {
    window.requestAnimationFrame(() => {
      const target = rootRef.current?.querySelector<HTMLButtonElement>(`[data-pf-date="${isoDate}"]`);
      target?.focus();
    });
  };

  const navigateMonth = (offset: number) => {
    const next = new Date(cursor.year, cursor.month + offset, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const onDateKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, isoDate: string) => {
    let delta = 0;
    if (event.key === 'ArrowRight') delta = 1;
    if (event.key === 'ArrowLeft') delta = -1;
    if (event.key === 'ArrowDown') delta = 7;
    if (event.key === 'ArrowUp') delta = -7;
    if (delta === 0) return;
    event.preventDefault();
    const current = new Date(`${isoDate}T00:00:00`);
    current.setDate(current.getDate() + delta);
    const nextIso = toIsoDateFromDate(current);
    setCursor({ year: current.getFullYear(), month: current.getMonth() });
    focusDateButton(nextIso);
  };

  return (
    <div className={cn('pf-calendar', sizeClass('md'), className)} ref={rootRef} {...rest}>
      <div className="pf-calendar__header">
        <button type="button" className="pf-calendar__nav" onClick={() => navigateMonth(-1)} aria-label="Previous month">
          {'<'}
        </button>
        <p className="pf-calendar__title">
          {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: timezone }).format(monthDate)}
        </p>
        <button type="button" className="pf-calendar__nav" onClick={() => navigateMonth(1)} aria-label="Next month">
          {'>'}
        </button>
      </div>

      <div className="pf-calendar__weekdays" role="row">
        {weekdayLabels.map((label) => (
          <span key={label} className="pf-calendar__weekday" role="columnheader">
            {label}
          </span>
        ))}
      </div>

      <div className="pf-calendar__grid" role="grid" aria-label="Calendar month view">
        {Array.from({ length: firstWeekday }).map((_, index) => (
          <span key={`blank-${index}`} className="pf-calendar__blank" aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
          const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const disabled = isDisabled(iso);
          const selectedDay = selected === iso;
          return (
            <button
              key={iso}
              type="button"
              className={cn(
                'pf-calendar__day',
                selectedDay && 'is-selected',
                disabled && 'is-disabled',
              )}
              data-pf-date={iso}
              disabled={disabled}
              aria-pressed={selectedDay}
              onClick={() => onValueChange?.(iso)}
              onKeyDown={(event) => onDateKeyDown(event, iso)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface PFClockProps extends HTMLAttributes<HTMLDivElement>, PFBaseProps {
  value?: string;
  locale?: string;
  timezone?: string;
  picker?: boolean;
  live?: boolean;
  showSeconds?: boolean;
  label?: ReactNode;
  onValueChange?: (value: string) => void;
}

export function PFClock({
  className,
  value,
  locale = 'en-US',
  timezone = 'UTC',
  picker = false,
  live = true,
  showSeconds = false,
  label,
  onValueChange,
  ...rest
}: PFClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!live) return;
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, [live]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: showSeconds ? '2-digit' : undefined,
        timeZone: timezone,
      }),
    [locale, showSeconds, timezone],
  );

  const pickerValue = normalizeTime(value);

  return (
    <div className={cn('pf-clock', className)} {...rest}>
      <div className="pf-clock__face">
        <p className="pf-clock__time">{picker && pickerValue ? pickerValue : formatter.format(now)}</p>
        <p className="pf-clock__zone">{timezone}</p>
      </div>
      {picker ? (
        <label className="pf-clock__picker">
          <span className="pf-form-label">{label ?? 'Set time'}</span>
          <input
            type="time"
            value={pickerValue}
            className={cn('pf-input', 'pf-size-md', 'pf-input--outline')}
            onChange={(event) => onValueChange?.(normalizeTime(event.target.value))}
          />
        </label>
      ) : null}
    </div>
  );
}
