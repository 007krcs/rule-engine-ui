import React from 'react';
import type { JSONValue, UIComponent } from '@platform/schema';
import type { AdapterContext } from '@platform/react-renderer';
import { registerAdapter } from '@platform/react-renderer';

let registered = false;

export function registerMaterialAdapters(): void {
  if (registered) return;
  registered = true;
  registerAdapter('material.', (component, ctx) => renderMaterial(component, ctx));
}

function renderMaterial(component: UIComponent, ctx: AdapterContext): React.ReactElement {
  const ariaLabel = ctx.i18n.t(component.accessibility.ariaLabelKey);
  switch (component.adapterHint) {
    case 'material.input': {
      const label = component.i18n?.labelKey
        ? ctx.i18n.t(component.i18n.labelKey)
        : String(component.props?.label ?? 'Input');
      const placeholder = component.i18n?.placeholderKey
        ? ctx.i18n.t(component.i18n.placeholderKey)
        : String(component.props?.placeholder ?? '');
      const helperText = component.i18n?.helperTextKey
        ? ctx.i18n.t(component.i18n.helperTextKey)
        : String(component.props?.helperText ?? '');
      const inputType = String(component.props?.inputType ?? 'text');
      const bindingPath = (component.bindings?.data?.value as string | undefined) ?? 'data.value';
      const boundValue = ctx.bindings.data.value?.value ?? (ctx.data as Record<string, JSONValue>).value ?? null;
      const inputValue =
        typeof boundValue === 'string' || typeof boundValue === 'number' ? boundValue : boundValue === null || boundValue === undefined ? '' : '';
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
      const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
        if (!ctx.events.onChange) return;
        let nextValue: JSONValue = event.target.value;
        if (inputType === 'number') {
          nextValue = event.target.value === '' ? null : Number(event.target.value);
        }
        if (isDateType) {
          nextValue = event.target.value === '' ? null : event.target.value;
        }
        ctx.events.onChange({
          componentId: component.id,
          value: nextValue,
          bindingPath,
        });
      };
      return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{label}</span>
          <input
            aria-label={ariaLabel}
            placeholder={placeholder}
            type={inputType}
            value={inputValue as string | number}
            onChange={handleChange}
            required={required}
            aria-invalid={isInvalid || undefined}
            data-invalid={isInvalid || undefined}
          />
          {helperText && <small style={{ color: '#666' }}>{helperText}</small>}
          {validationMessage ? (
            <small style={{ color: '#b91c1c' }} role="alert">
              {validationMessage}
            </small>
          ) : null}
        </label>
      );
    }
    case 'material.button': {
      const label = component.i18n?.labelKey
        ? ctx.i18n.t(component.i18n.labelKey)
        : String(component.props?.label ?? 'Button');
      return (
        <button aria-label={ariaLabel} onClick={() => ctx.events.onClick?.({ componentId: component.id })}>
          {label}
        </button>
      );
    }
    default:
      return (
        <div data-unsupported>
          Unsupported material component: {component.adapterHint}
        </div>
      );
  }
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
