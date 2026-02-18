import React from 'react';
import { Button, MenuItem, TextField } from '@mui/material';
import type { JSONValue, UIComponent } from '@platform/schema';
import type { AdapterContext, AdapterRegistry } from '@platform/react-renderer';
import { getDefaultAdapterRegistry, registerAdapter } from '@platform/react-renderer';

const registeredRegistries = new WeakSet<AdapterRegistry>();

export function registerMaterialAdapters(
  adapterRegistry: AdapterRegistry = getDefaultAdapterRegistry(),
): void {
  if (registeredRegistries.has(adapterRegistry)) return;
  registeredRegistries.add(adapterRegistry);
  registerAdapter('material.', (component, ctx) => renderMaterial(component, ctx), adapterRegistry);
}

function renderMaterial(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  switch (component.adapterHint) {
    case 'material.input':
      return renderMaterialInput(component, ctx, ariaLabel);
    case 'material.button':
      return renderMaterialButton(component, ctx, ariaLabel);
    default:
      return (
        <div data-unsupported>
          Unsupported material component: {component.adapterHint}
        </div>
      );
  }
}

function renderMaterialInput(
  component: UIComponent,
  ctx: AdapterContext,
  ariaLabel: string,
): React.ReactElement {
  const label = component.i18n?.labelKey
    ? ctx.i18n.t(component.i18n.labelKey)
    : String(component.props?.label ?? 'Input');
  const placeholder = component.i18n?.placeholderKey
    ? ctx.i18n.t(component.i18n.placeholderKey)
    : String(component.props?.placeholder ?? '');
  const helperText = component.i18n?.helperTextKey
    ? ctx.i18n.t(component.i18n.helperTextKey)
    : String(component.props?.helperText ?? '');
  const inputType = String(component.props?.inputType ?? component.props?.type ?? 'text');
  const field =
    typeof component.props?.field === 'string' && component.props.field.trim().length > 0
      ? component.props.field
      : 'value';
  const bindingPath =
    (component.bindings?.data?.[field] as string | undefined) ??
    (component.bindings?.data?.value as string | undefined) ??
    `data.${field}`;
  const boundValue =
    ctx.bindings.data[field]?.value ??
    ctx.bindings.data.value?.value ??
    (ctx.data as Record<string, JSONValue>)[field] ??
    null;
  const inputValue =
    typeof boundValue === 'string' || typeof boundValue === 'number'
      ? boundValue
      : boundValue === null || boundValue === undefined
        ? ''
        : '';
  const required = component.validations?.required ?? false;
  const isDateType = inputType === 'date' || inputType === 'datetime-local';
  const dateValid = isDateType ? isValidDateInput(String(inputValue), inputType) : true;
  const requiredMissing = required && String(inputValue).length === 0;
  const isInvalid = requiredMissing || (!requiredMissing && isDateType && String(inputValue).length > 0 && !dateValid);
  const validationMessage = requiredMissing
    ? 'This field is required.'
    : isDateType && String(inputValue).length > 0 && !dateValid
      ? inputType === 'date'
        ? 'Use YYYY-MM-DD.'
        : 'Use YYYY-MM-DDThh:mm.'
      : '';
  const variant = toTextFieldVariant(component.props?.variant);
  const size = toControlSize(component.props?.size);
  const disabled = Boolean(component.props?.disabled);
  const options = toOptions(component.props?.options);
  const selectMode = Boolean(component.props?.select) || options.length > 0;

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    if (!ctx.events.onChange) return;
    let nextValue: JSONValue = event.target.value;
    if (inputType === 'number') {
      nextValue = event.target.value === '' ? null : Number(event.target.value);
    }
    if (isDateType) {
      nextValue = event.target.value === '' ? null : event.target.value;
    }
    ctx.events.onChange(nextValue, bindingPath);
  };

  return (
    <TextField
      variant={variant}
      size={size}
      fullWidth={Boolean(component.props?.fullWidth ?? true)}
      label={label}
      placeholder={placeholder}
      helperText={validationMessage || helperText}
      required={required}
      disabled={disabled}
      error={isInvalid}
      type={selectMode ? undefined : inputType}
      value={inputValue as string | number}
      onChange={handleChange}
      select={selectMode}
      slotProps={{
        htmlInput: {
          'aria-label': ariaLabel,
          'data-mui-component': 'material-text-field',
        },
      }}
    >
      {selectMode
        ? options.map((option) => (
            <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </MenuItem>
          ))
        : null}
    </TextField>
  );
}

function renderMaterialButton(
  component: UIComponent,
  ctx: AdapterContext,
  ariaLabel: string,
): React.ReactElement {
  const label = component.i18n?.labelKey
    ? ctx.i18n.t(component.i18n.labelKey)
    : String(component.props?.label ?? 'Button');

  return (
    <Button
      variant={toMuiButtonVariant(component.props?.variant)}
      color={toMuiButtonColor(component.props?.color)}
      size={toControlSize(component.props?.size)}
      disabled={Boolean(component.props?.disabled)}
      aria-label={ariaLabel}
      data-mui-component="material-button"
      onClick={() => ctx.events.onClick?.({ componentId: component.id })}
    >
      {label}
    </Button>
  );
}

function isValidDateInput(value: string, inputType: string): boolean {
  if (!value) return true;
  if (inputType === 'date') {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }
  if (inputType === 'datetime-local') {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value);
  }
  return true;
}

function toTextFieldVariant(value: unknown): 'filled' | 'outlined' | 'standard' {
  if (value === 'filled' || value === 'outlined' || value === 'standard') return value;
  if (value === 'ghost') return 'standard';
  return 'outlined';
}

function toControlSize(value: unknown): 'small' | 'medium' {
  return value === 'sm' || value === 'small' ? 'small' : 'medium';
}

function toMuiButtonVariant(value: unknown): 'text' | 'outlined' | 'contained' {
  if (value === 'outlined' || value === 'text' || value === 'contained') return value;
  if (value === 'outline') return 'outlined';
  if (value === 'ghost') return 'text';
  return 'contained';
}

function toMuiButtonColor(
  value: unknown,
): 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning' {
  if (
    value === 'inherit' ||
    value === 'primary' ||
    value === 'secondary' ||
    value === 'success' ||
    value === 'error' ||
    value === 'info' ||
    value === 'warning'
  ) {
    return value;
  }
  return 'primary';
}

function toOptions(
  raw: unknown,
): Array<{ value: string; label: string; disabled?: boolean }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map<{ value: string; label: string; disabled?: boolean } | null>((value) => {
      if (!value || typeof value !== 'object') return null;
      const item = value as { value?: unknown; label?: unknown; labelKey?: unknown; disabled?: unknown };
      if (typeof item.value !== 'string') return null;
      const label =
        typeof item.label === 'string'
          ? item.label
          : typeof item.labelKey === 'string'
            ? item.labelKey
            : item.value;
      return {
        value: item.value,
        label,
        disabled: item.disabled === true ? true : undefined,
      };
    })
    .filter((item): item is { value: string; label: string; disabled?: boolean } => item !== null);
}
