import type { JSONValue } from '@platform/schema';

export type RegistryScope = 'global' | 'tenant';

export type ComponentRegistryManifest = {
  schemaVersion: 1;
  components: ComponentDefinition[];
};

export type ComponentDefinition = {
  adapterHint: string;
  displayName: string;
  category: string;
  propsSchema: JsonSchema;
  defaultProps?: Record<string, JSONValue>;
  bindings?: {
    data?: string[];
    context?: string[];
    computed?: string[];
  };
  accessibility?: {
    // RuleFlow enforces ariaLabelKey + keyboardNav + focusOrder on UISchema components.
    // Registry metadata can be used for UX hints (e.g. "requires labelKey").
    requiresI18nLabelKey?: boolean;
  };
  preview?: {
    thumbnailSvg?: string;
  };
};

// Minimal JSON Schema subset for props editing. Keep this headless:
// - enough to auto-render a reasonable form in Builder
// - still compatible with full JSON Schema objects stored by companies
export type JsonSchema =
  | {
      type: 'object';
      title?: string;
      description?: string;
      properties?: Record<string, JsonSchema>;
      required?: string[];
      additionalProperties?: boolean;
    }
  | {
      type: 'string';
      title?: string;
      description?: string;
      enum?: string[];
      default?: string;
    }
  | {
      type: 'number' | 'integer';
      title?: string;
      description?: string;
      minimum?: number;
      maximum?: number;
      default?: number;
    }
  | {
      type: 'boolean';
      title?: string;
      description?: string;
      default?: boolean;
    }
  | {
      type: 'array';
      title?: string;
      description?: string;
      items?: JsonSchema;
    }
  | {
      // fallback for "any" or unknown schemas
      type?: string;
      title?: string;
      description?: string;
      [key: string]: unknown;
    };

export interface RegistryValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface RegistryValidationResult {
  valid: boolean;
  issues: RegistryValidationIssue[];
}

export function validateComponentRegistryManifest(value: unknown): RegistryValidationResult {
  const issues: RegistryValidationIssue[] = [];

  if (!isPlainObject(value)) {
    return { valid: false, issues: [{ path: 'root', message: 'manifest must be an object', severity: 'error' }] };
  }

  const schemaVersion = (value as Record<string, unknown>).schemaVersion;
  if (schemaVersion !== 1) {
    issues.push({ path: 'schemaVersion', message: 'schemaVersion must be 1', severity: 'error' });
  }

  const components = (value as Record<string, unknown>).components;
  if (!Array.isArray(components)) {
    issues.push({ path: 'components', message: 'components must be an array', severity: 'error' });
  } else {
    const seen = new Set<string>();
    components.forEach((component, index) => {
      const basePath = `components[${index}]`;
      const result = validateComponentDefinition(component);
      for (const issue of result.issues) {
        issues.push({ ...issue, path: `${basePath}.${issue.path}` });
      }

      if (isPlainObject(component) && typeof component.adapterHint === 'string') {
        const adapterHint = component.adapterHint.trim();
        if (seen.has(adapterHint)) {
          issues.push({ path: `${basePath}.adapterHint`, message: `duplicate adapterHint: ${adapterHint}`, severity: 'error' });
        }
        seen.add(adapterHint);
      }
    });
  }

  return { valid: issues.filter((i) => i.severity === 'error').length === 0, issues };
}

export function validateComponentDefinition(value: unknown): RegistryValidationResult {
  const issues: RegistryValidationIssue[] = [];

  if (!isPlainObject(value)) {
    return { valid: false, issues: [{ path: 'root', message: 'component must be an object', severity: 'error' }] };
  }

  const rec = value as Record<string, unknown>;
  const adapterHint = typeof rec.adapterHint === 'string' ? rec.adapterHint.trim() : '';
  if (!adapterHint) {
    issues.push({ path: 'adapterHint', message: 'adapterHint is required', severity: 'error' });
  }
  if (adapterHint && !adapterHint.includes('.')) {
    issues.push({ path: 'adapterHint', message: 'adapterHint should be namespaced (e.g. company.currencyInput)', severity: 'warning' });
  }

  const displayName = typeof rec.displayName === 'string' ? rec.displayName.trim() : '';
  if (!displayName) {
    issues.push({ path: 'displayName', message: 'displayName is required', severity: 'error' });
  }

  const category = typeof rec.category === 'string' ? rec.category.trim() : '';
  if (!category) {
    issues.push({ path: 'category', message: 'category is required', severity: 'error' });
  }

  if (!rec.propsSchema) {
    issues.push({ path: 'propsSchema', message: 'propsSchema is required', severity: 'error' });
  } else if (!isPlainObject(rec.propsSchema)) {
    issues.push({ path: 'propsSchema', message: 'propsSchema must be an object (JSON Schema)', severity: 'error' });
  }

  if (rec.defaultProps !== undefined && !isPlainObject(rec.defaultProps)) {
    issues.push({ path: 'defaultProps', message: 'defaultProps must be an object', severity: 'error' });
  }

  if (rec.bindings !== undefined && !isPlainObject(rec.bindings)) {
    issues.push({ path: 'bindings', message: 'bindings must be an object', severity: 'error' });
  }

  return { valid: issues.filter((i) => i.severity === 'error').length === 0, issues };
}

export function builtinComponentDefinitions(): ComponentDefinition[] {
  return [
    {
      adapterHint: 'material.input',
      displayName: 'Text Input',
      category: 'Inputs',
      propsSchema: {
        type: 'object',
        properties: {
          label: { type: 'string', title: 'Label', default: 'Text field' },
          placeholder: { type: 'string', title: 'Placeholder', default: 'Type here...' },
          helperText: { type: 'string', title: 'Helper Text' },
          inputType: {
            type: 'string',
            title: 'Input Type',
            enum: ['text', 'number', 'email', 'date', 'datetime-local'],
            default: 'text',
          },
        },
        additionalProperties: true,
      },
      defaultProps: { label: 'Text field', placeholder: 'Type here...', inputType: 'text' },
      bindings: { data: ['value'] },
      accessibility: { requiresI18nLabelKey: false },
    },
    {
      adapterHint: 'material.button',
      displayName: 'Button',
      category: 'Actions',
      propsSchema: {
        type: 'object',
        properties: {
          label: { type: 'string', title: 'Label', default: 'Action button' },
        },
        additionalProperties: true,
      },
      defaultProps: { label: 'Action button' },
    },
    {
      adapterHint: 'aggrid.table',
      displayName: 'Table',
      category: 'Data',
      propsSchema: {
        type: 'object',
        properties: {
          columns: {
            type: 'array',
            title: 'Columns',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', title: 'Field' },
              },
              additionalProperties: true,
            },
          },
        },
        additionalProperties: true,
      },
      defaultProps: { columns: [{ field: 'id' }, { field: 'status' }], rows: [] },
      bindings: { data: ['rows'] },
    },
    {
      adapterHint: 'highcharts.chart',
      displayName: 'Chart',
      category: 'Data',
      propsSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', title: 'Title', default: 'Chart' },
          series: { type: 'array', title: 'Series', items: { type: 'number' } },
        },
        additionalProperties: true,
      },
      defaultProps: { title: 'Revenue', series: [2, 7, 4, 9] },
      bindings: { data: ['series'] },
    },
    {
      adapterHint: 'd3.custom',
      displayName: 'Custom Visualization',
      category: 'Data',
      propsSchema: {
        type: 'object',
        properties: {
          height: { type: 'number', title: 'Height', default: 240, minimum: 80 },
        },
        additionalProperties: true,
      },
      defaultProps: { height: 240 },
      bindings: { data: ['dataset'] },
    },
    {
      adapterHint: 'company.currencyInput',
      displayName: 'Currency Input',
      category: 'Company',
      propsSchema: {
        type: 'object',
        properties: {
          label: { type: 'string', title: 'Label', default: 'Amount' },
          currency: { type: 'string', title: 'Currency', enum: ['USD', 'EUR', 'GBP'], default: 'USD' },
          min: { type: 'number', title: 'Min' },
          max: { type: 'number', title: 'Max' },
        },
        additionalProperties: true,
      },
      defaultProps: { label: 'Amount', currency: 'USD' },
      bindings: { data: ['value'] },
    },
    {
      adapterHint: 'company.riskBadge',
      displayName: 'Risk Badge',
      category: 'Company',
      propsSchema: {
        type: 'object',
        properties: {
          label: { type: 'string', title: 'Label', default: 'Risk' },
          level: { type: 'string', title: 'Level', enum: ['Low', 'Medium', 'High'], default: 'Low' },
        },
        additionalProperties: true,
      },
      defaultProps: { label: 'Risk', level: 'Low' },
      bindings: { data: ['level'] },
    },
  ];
}

export function mergeComponentDefinitions(
  base: ComponentDefinition[],
  overrides: ComponentDefinition[],
): ComponentDefinition[] {
  const byHint = new Map<string, ComponentDefinition>();
  for (const item of base) byHint.set(item.adapterHint, item);
  for (const item of overrides) byHint.set(item.adapterHint, item);
  return Array.from(byHint.values()).sort((a, b) => a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
