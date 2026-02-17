import type {
  ChangeEvent,
  HTMLAttributes,
  InputHTMLAttributes,
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
