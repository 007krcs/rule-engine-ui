import type {
  ChangeEvent,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
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
}

export function PFTextField({
  id,
  label,
  helperText,
  error = false,
  className,
  ...rest
}: PFTextFieldProps) {
  const describedBy = helperText ? `${id}-helper` : undefined;
  return (
    <div className={cn('pf-text-field', className)}>
      {label ? <PFFormLabel htmlFor={id}>{label}</PFFormLabel> : null}
      <PFInput id={id} aria-invalid={error || undefined} aria-describedby={describedBy} {...rest} />
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
}

export interface PFAutocompleteProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    PFBaseProps {
  options: PFAutocompleteOption[];
  variant?: FieldVariant;
  loading?: boolean;
}

export function PFAutocomplete({
  className,
  size = 'md',
  options,
  variant = 'outline',
  id,
  loading = false,
  ...rest
}: PFAutocompleteProps) {
  const listId = id ? `${id}-list` : undefined;
  return (
    <span className={cn('pf-field-wrap', loading && 'is-loading')}>
      <input
        {...rest}
        id={id}
        list={listId}
        autoComplete="off"
        className={cn('pf-input', sizeClass(size), `pf-input--${variant}`, className)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={undefined}
        aria-busy={loading || undefined}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label ?? option.value}
          </option>
        ))}
      </datalist>
      {loading ? <span className="pf-spinner pf-field-wrap__spinner" aria-hidden="true" /> : null}
    </span>
  );
}
