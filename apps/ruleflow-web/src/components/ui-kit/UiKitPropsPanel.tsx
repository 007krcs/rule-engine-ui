'use client';

import type { ComponentDefinition, JsonSchema } from '@platform/component-registry';
import { PFButton, PFSelect, PFSwitch, PFTextField, PFTypography } from '@platform/ui-kit';
import styles from './UiKitPropsPanel.module.scss';

export interface UiKitPropsPanelProps {
  component: ComponentDefinition | null;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  onReset: () => void;
}

export function UiKitPropsPanel({ component, values, onChange, onReset }: UiKitPropsPanelProps) {
  if (!component) {
    return (
      <aside className={styles.panel}>
        <PFTypography variant="h5">Props</PFTypography>
        <PFTypography variant="body2" muted>
          Select a component to edit props.
        </PFTypography>
      </aside>
    );
  }

  const properties = readProperties(component.propsSchema);

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div>
          <PFTypography variant="h5">Props Controls</PFTypography>
          <PFTypography variant="body2" muted>
            Interactive controls generated from registry props schema.
          </PFTypography>
        </div>
        <PFButton size="sm" variant="outline" intent="neutral" onClick={onReset}>
          Reset defaults
        </PFButton>
      </div>

      {properties.length === 0 ? (
        <p className={styles.empty}>No editable primitive props found for this component.</p>
      ) : (
        <div className={styles.controls}>
          {properties.map(([name, schema]) => (
            <PropControl
              key={name}
              name={name}
              schema={schema}
              value={values[name]}
              onChange={(value) => onChange(name, value)}
            />
          ))}
        </div>
      )}
    </aside>
  );
}

function PropControl({
  name,
  schema,
  value,
  onChange,
}: {
  name: string;
  schema: JsonSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = schema.title ?? name;
  const helperText = schema.description;
  const testId = `ui-kit-prop-${name}`;

  if (schema.type === 'boolean') {
    return (
      <div className={styles.controlBlock}>
        <PFSwitch
          id={`prop-${name}`}
          checked={Boolean(value)}
          onCheckedChange={onChange}
          label={label}
          data-testid={testId}
        />
        {helperText ? <p className={styles.helper}>{helperText}</p> : null}
      </div>
    );
  }

  if (schema.type === 'string' && Array.isArray(schema.enum) && schema.enum.length > 0) {
    return (
      <div className={styles.controlBlock}>
        <label htmlFor={`prop-${name}`} className={styles.label}>
          {label}
        </label>
        <PFSelect
          id={`prop-${name}`}
          value={String(value ?? schema.enum[0])}
          options={schema.enum.map((entry) => ({ value: entry, label: entry }))}
          onChange={(event) => onChange(event.target.value)}
          data-testid={testId}
        />
        {helperText ? <p className={styles.helper}>{helperText}</p> : null}
      </div>
    );
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return (
      <div className={styles.controlBlock}>
        <PFTextField
          id={`prop-${name}`}
          type="number"
          label={label}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
          helperText={helperText}
          data-testid={testId}
        />
      </div>
    );
  }

  if (schema.type === 'string') {
    return (
      <div className={styles.controlBlock}>
        <PFTextField
          id={`prop-${name}`}
          label={label}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(event) => onChange(event.target.value)}
          helperText={helperText}
          data-testid={testId}
        />
      </div>
    );
  }

  return (
    <div className={styles.controlBlock}>
      <p className={styles.label}>{label}</p>
      <p className={styles.unsupported}>
        Complex prop type{schema.type ? ` "${schema.type}"` : ''} is not editable in live controls.
      </p>
    </div>
  );
}

function readProperties(schema: JsonSchema): Array<[string, JsonSchema]> {
  if (schema.type !== 'object' || !schema.properties) return [];
  return Object.entries(schema.properties);
}
