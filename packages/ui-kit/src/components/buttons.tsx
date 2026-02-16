import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn, intentClass, sizeClass, variantClass, type PFBaseProps, type PFIntent, type PFVariant } from './utils';

export interface PFButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'>,
    PFBaseProps {
  variant?: PFVariant;
  intent?: PFIntent;
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  fullWidth?: boolean;
}

export function PFButton({
  className,
  size = 'md',
  variant = 'contained',
  intent = 'primary',
  loading = false,
  disabled,
  startIcon,
  endIcon,
  fullWidth = false,
  type = 'button',
  children,
  ...rest
}: PFButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      type={type}
      className={cn(
        'pf-button',
        sizeClass(size),
        variantClass('pf-button', variant),
        intentClass('pf-button', intent),
        fullWidth && 'pf-button--full',
        loading && 'is-loading',
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
    >
      {loading ? (
        <span className="pf-spinner" aria-hidden="true" />
      ) : (
        startIcon && <span className="pf-button__icon pf-button__icon--start">{startIcon}</span>
      )}
      <span className="pf-button__label">{children}</span>
      {endIcon && <span className="pf-button__icon pf-button__icon--end">{endIcon}</span>}
    </button>
  );
}

export interface PFIconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'>,
    PFBaseProps {
  variant?: PFVariant;
  intent?: PFIntent;
  loading?: boolean;
  label: string;
}

export function PFIconButton({
  className,
  size = 'md',
  variant = 'ghost',
  intent = 'neutral',
  loading = false,
  disabled,
  label,
  type = 'button',
  children,
  ...rest
}: PFIconButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      type={type}
      className={cn(
        'pf-icon-button',
        sizeClass(size),
        variantClass('pf-icon-button', variant),
        intentClass('pf-icon-button', intent),
        loading && 'is-loading',
        className,
      )}
      disabled={isDisabled}
      aria-label={label}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="pf-spinner" aria-hidden="true" /> : children}
    </button>
  );
}

export interface PFButtonGroupProps {
  children: ReactNode;
  className?: string;
  vertical?: boolean;
  ariaLabel?: string;
}

export function PFButtonGroup({ children, className, vertical = false, ariaLabel }: PFButtonGroupProps) {
  return (
    <div className={cn('pf-button-group', vertical && 'pf-button-group--vertical', className)} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

export interface PFToggleOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface PFToggleButtonGroupProps extends PFBaseProps {
  options: PFToggleOption[];
  value: string | string[];
  onChange?: (value: string | string[]) => void;
  exclusive?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function PFToggleButtonGroup({
  options,
  value,
  onChange,
  exclusive = true,
  disabled = false,
  className,
  size = 'md',
  ariaLabel = 'Toggle button group',
}: PFToggleButtonGroupProps) {
  const selectedValues = Array.isArray(value) ? value : [value];

  const selectValue = (next: string): void => {
    if (!onChange) return;
    if (exclusive) {
      onChange(next);
      return;
    }

    const set = new Set(selectedValues);
    if (set.has(next)) {
      set.delete(next);
    } else {
      set.add(next);
    }
    onChange(Array.from(set));
  };

  return (
    <div className={cn('pf-toggle-group', sizeClass(size), className)} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={cn('pf-toggle', isSelected && 'is-selected')}
            onClick={() => selectValue(option.value)}
            aria-pressed={isSelected}
            disabled={disabled || option.disabled}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
