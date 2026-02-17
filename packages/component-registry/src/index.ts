import type { JSONValue } from '@platform/schema';

export type RegistryScope = 'global' | 'tenant';

export type ComponentStatus = 'stable' | 'beta' | 'planned';

export type ComponentCategory =
  | 'Inputs'
  | 'Data Display'
  | 'Feedback'
  | 'Surfaces'
  | 'Navigation'
  | 'Layout'
  | 'Utils'
  | 'External';

export type ComponentRegistryManifest = {
  schemaVersion: 1;
  components: ComponentDefinition[];
};

export type ComponentDefinition = {
  adapterHint: string;
  displayName: string;
  category: ComponentCategory | string;
  propsSchema: JsonSchema;
  defaultProps?: Record<string, JSONValue>;
  bindings?: {
    data?: string[];
    context?: string[];
    computed?: string[];
  };
  i18n?: {
    nameKey: string;
    descriptionKey: string;
  };
  schemaSupport?: {
    allowedProps?: string[];
    allowedBindings?: {
      data?: string[];
      context?: string[];
      computed?: string[];
    };
    supportsRules?: Array<'visibleWhen' | 'disabledWhen' | 'requiredWhen' | 'setValueWhen'>;
    notes?: string[];
  };
  accessibility?: {
    requiresI18nLabelKey?: boolean;
    requirements?: string[];
  };
  tokensUsed?: string[];
  status?: ComponentStatus;
  palette?: {
    disabled?: boolean;
    reason?: string;
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

type SeedComponent = {
  adapterHint: string;
  displayName: string;
  category: ComponentCategory;
  description: string;
  status: ComponentStatus;
  propsSchema?: JsonSchema;
  defaultProps?: Record<string, JSONValue>;
  bindings?: {
    data?: string[];
    context?: string[];
    computed?: string[];
  };
  accessibilityRequirements?: string[];
  tokensUsed?: string[];
};

const COMMON_RULES: Array<'visibleWhen' | 'disabledWhen' | 'requiredWhen' | 'setValueWhen'> = [
  'visibleWhen',
  'disabledWhen',
  'requiredWhen',
  'setValueWhen',
];

const CATALOG_SEEDS: SeedComponent[] = [
  // Inputs
  seed('platform.textField', 'TextField', 'Inputs', 'Single-line text input with label, helper text, and validation.', 'stable', {
    propsSchema: objectSchema('Text input field', {
      label: stringSchema('Label', 'Field label.'),
      placeholder: stringSchema('Placeholder', 'Placeholder text.'),
      helperText: stringSchema('Helper Text', 'Support text.'),
    }),
    bindings: { data: ['value'] },
    tokensUsed: ['--pf-control-bg', '--pf-control-border-color', '--pf-font-size-md'],
  }),
  seed('platform.numberField', 'NumberField', 'Inputs', 'Numeric text field with min/max support.', 'stable', {
    propsSchema: objectSchema('Numeric input', {
      label: stringSchema('Label'),
      min: numberSchema('Min'),
      max: numberSchema('Max'),
      step: numberSchema('Step'),
    }),
    bindings: { data: ['value'] },
    tokensUsed: ['--pf-control-height-md', '--pf-control-focus-border'],
  }),
  seed('platform.select', 'Select', 'Inputs', 'Dropdown list with keyboard navigation.', 'stable', {
    propsSchema: objectSchema('Select field', {
      label: stringSchema('Label'),
      placeholder: stringSchema('Placeholder'),
      options: arraySchema('Options', objectSchema('Option', {
        value: stringSchema('Value'),
        label: stringSchema('Label'),
      })),
    }),
    bindings: { data: ['value'] },
    tokensUsed: ['--pf-control-bg', '--pf-control-radius'],
  }),
  seed('platform.checkbox', 'Checkbox', 'Inputs', 'Boolean checkbox control.', 'stable', {
    propsSchema: objectSchema('Checkbox', {
      label: stringSchema('Label'),
      helperText: stringSchema('Helper Text'),
    }),
    bindings: { data: ['checked'] },
    tokensUsed: ['--pf-color-primary-500', '--pf-space-2'],
  }),
  seed('platform.radioGroup', 'RadioGroup', 'Inputs', 'Mutually exclusive option selector.', 'beta', {
    propsSchema: objectSchema('Radio group', {
      label: stringSchema('Label'),
      options: arraySchema('Options', objectSchema('Option', {
        value: stringSchema('Value'),
        label: stringSchema('Label'),
      })),
    }),
    bindings: { data: ['value'] },
    tokensUsed: ['--pf-space-2', '--pf-font-size-sm'],
  }),
  seed('platform.switch', 'Switch', 'Inputs', 'Binary switch control.', 'stable', {
    propsSchema: objectSchema('Switch', {
      label: stringSchema('Label'),
    }),
    bindings: { data: ['checked'] },
    tokensUsed: ['--pf-color-primary-500', '--pf-control-height-sm'],
  }),
  seed('platform.slider', 'Slider', 'Inputs', 'Range selector with keyboard support.', 'beta', {
    propsSchema: objectSchema('Slider', {
      min: numberSchema('Min'),
      max: numberSchema('Max'),
      step: numberSchema('Step'),
    }),
    bindings: { data: ['value'] },
    tokensUsed: ['--pf-color-primary-500', '--pf-space-2'],
  }),
  seed('platform.autocomplete', 'Autocomplete', 'Inputs', 'Type-ahead input with async option loading.', 'stable', {
    propsSchema: objectSchema('Autocomplete', {
      label: stringSchema('Label'),
      placeholder: stringSchema('Placeholder'),
      async: booleanSchema('Async'),
      debounceMs: numberSchema('Debounce ms'),
    }),
    bindings: { data: ['value', 'query'] },
    tokensUsed: ['--pf-control-bg', '--pf-surface-border', '--pf-z-dropdown'],
  }),
  seed('platform.textareaAutosize', 'TextareaAutosize', 'Inputs', 'Multi-line text input that grows by content.', 'beta', {
    propsSchema: objectSchema('Textarea autosize', {
      label: stringSchema('Label'),
      minRows: numberSchema('Min Rows'),
      maxRows: numberSchema('Max Rows'),
    }),
    bindings: { data: ['value'] },
    tokensUsed: ['--pf-control-bg', '--pf-control-radius'],
  }),
  seed('platform.inputAdornment', 'InputAdornment', 'Inputs', 'Prefix/suffix adornments for input controls.', 'stable', {
    propsSchema: objectSchema('Input adornment', {
      position: stringEnumSchema('Position', ['start', 'end']),
      text: stringSchema('Text'),
    }),
    tokensUsed: ['--pf-control-adornment', '--pf-space-2'],
  }),

  // Data display
  seed('platform.avatar', 'Avatar', 'Data Display', 'User avatar image or initials.', 'stable', {
    propsSchema: objectSchema('Avatar', {
      src: stringSchema('Image URL'),
      name: stringSchema('Name'),
    }),
    tokensUsed: ['--pf-radius-full', '--pf-color-primary-200'],
  }),
  seed('platform.badge', 'Badge', 'Data Display', 'Small count or status indicator.', 'stable', {
    propsSchema: objectSchema('Badge', {
      badgeContent: stringSchema('Content'),
      intent: stringEnumSchema('Intent', ['primary', 'neutral', 'success', 'warn', 'error']),
    }),
    tokensUsed: ['--pf-color-primary-500', '--pf-radius-full'],
  }),
  seed('platform.chip', 'Chip', 'Data Display', 'Compact information pill with optional action.', 'stable', {
    propsSchema: objectSchema('Chip', {
      label: stringSchema('Label'),
      intent: stringEnumSchema('Intent', ['neutral', 'primary', 'secondary', 'success', 'warn', 'error']),
    }),
    tokensUsed: ['--pf-radius-full', '--pf-space-2'],
  }),
  seed('platform.divider', 'Divider', 'Data Display', 'Horizontal or vertical visual separator.', 'stable', {
    propsSchema: objectSchema('Divider', {
      orientation: stringEnumSchema('Orientation', ['horizontal', 'vertical']),
    }),
    tokensUsed: ['--pf-surface-border'],
  }),
  seed('platform.svgIcon', 'SvgIcon', 'Data Display', 'Scalable icon wrapper component.', 'planned'),
  seed('platform.list', 'List', 'Data Display', 'Structured list with item actions and keyboard focus.', 'beta', {
    propsSchema: objectSchema('List', {
      items: arraySchema('Items', objectSchema('Item', {
        id: stringSchema('Id'),
        label: stringSchema('Label'),
      })),
    }),
    bindings: { data: ['items'] },
    tokensUsed: ['--pf-space-2', '--pf-surface-border'],
  }),
  seed('platform.table', 'Table', 'Data Display', 'Data table with header and basic sorting hooks.', 'stable', {
    propsSchema: objectSchema('Table', {
      columns: arraySchema('Columns', objectSchema('Column', {
        id: stringSchema('Id'),
        header: stringSchema('Header'),
      })),
    }),
    bindings: { data: ['rows'] },
    tokensUsed: ['--pf-table-bg', '--pf-table-border', '--pf-table-header-bg'],
  }),
  seed('platform.tooltip', 'Tooltip', 'Data Display', 'Context hint on hover/focus.', 'stable', {
    propsSchema: objectSchema('Tooltip', {
      content: stringSchema('Content'),
      placement: stringEnumSchema('Placement', ['top', 'bottom', 'left', 'right']),
    }),
    tokensUsed: ['--pf-z-tooltip', '--pf-color-neutral-900'],
  }),
  seed('platform.typography', 'Typography', 'Data Display', 'Semantic typography scale component.', 'stable', {
    propsSchema: objectSchema('Typography', {
      variant: stringEnumSchema('Variant', ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body1', 'body2', 'caption', 'label', 'code']),
    }),
    tokensUsed: ['--pf-font-size-md', '--pf-line-height-normal'],
  }),
  seed('platform.imageList', 'ImageList', 'Data Display', 'Responsive grid of images with captions.', 'planned'),

  // Feedback
  seed('platform.alert', 'Alert', 'Feedback', 'Inline alert for status messaging.', 'stable', {
    propsSchema: objectSchema('Alert', {
      title: stringSchema('Title'),
      intent: stringEnumSchema('Intent', ['neutral', 'primary', 'success', 'warn', 'error']),
    }),
    tokensUsed: ['--pf-color-success-100', '--pf-radius-md'],
  }),
  seed('platform.snackbar', 'Snackbar', 'Feedback', 'Transient toast/snackbar notifications.', 'stable', {
    propsSchema: objectSchema('Snackbar', {
      message: stringSchema('Message'),
      autoHideDuration: numberSchema('Auto Hide Duration'),
    }),
    tokensUsed: ['--pf-snackbar-bg', '--pf-z-toast'],
  }),
  seed('platform.dialog', 'Dialog', 'Feedback', 'Modal dialog with focus management.', 'stable', {
    propsSchema: objectSchema('Dialog', {
      title: stringSchema('Title'),
      description: stringSchema('Description'),
      size: stringEnumSchema('Size', ['sm', 'md', 'lg']),
    }),
    tokensUsed: ['--pf-dialog-bg', '--pf-dialog-shadow', '--pf-z-modal'],
  }),
  seed('platform.progressLinear', 'ProgressLinear', 'Feedback', 'Linear progress indicator.', 'stable', {
    propsSchema: objectSchema('Progress Linear', {
      value: numberSchema('Value'),
      indeterminate: booleanSchema('Indeterminate'),
    }),
    tokensUsed: ['--pf-color-primary-400', '--pf-radius-full'],
  }),
  seed('platform.progressCircular', 'ProgressCircular', 'Feedback', 'Circular progress indicator.', 'stable', {
    propsSchema: objectSchema('Progress Circular', {
      value: numberSchema('Value'),
      indeterminate: booleanSchema('Indeterminate'),
    }),
    tokensUsed: ['--pf-color-primary-500', '--pf-motion-fast'],
  }),
  seed('platform.skeleton', 'Skeleton', 'Feedback', 'Loading placeholder blocks.', 'stable', {
    propsSchema: objectSchema('Skeleton', {
      variant: stringEnumSchema('Variant', ['text', 'rectangular', 'rounded', 'circular']),
      animated: booleanSchema('Animated'),
    }),
    tokensUsed: ['--pf-color-neutral-100', '--pf-motion-normal'],
  }),

  // Surfaces
  seed('platform.accordion', 'Accordion', 'Surfaces', 'Expandable/collapsible content sections.', 'stable', {
    propsSchema: objectSchema('Accordion', {
      title: stringSchema('Title'),
      defaultExpanded: booleanSchema('Default Expanded'),
    }),
    tokensUsed: ['--pf-surface-layer', '--pf-surface-border', '--pf-space-3'],
  }),
  seed('platform.appBar', 'AppBar', 'Surfaces', 'Application top bar container.', 'stable', {
    propsSchema: objectSchema('App Bar', {
      position: stringEnumSchema('Position', ['static', 'sticky']),
    }),
    tokensUsed: ['--pf-surface-layer', '--pf-z-sticky'],
  }),
  seed('platform.toolbar', 'Toolbar', 'Surfaces', 'Horizontal toolbar content row.', 'stable', {
    propsSchema: objectSchema('Toolbar', {}),
    tokensUsed: ['--pf-space-3', '--pf-control-height-lg'],
  }),
  seed('platform.card', 'Card', 'Surfaces', 'Card surface with header/body/actions slots.', 'stable', {
    propsSchema: objectSchema('Card', {
      elevated: booleanSchema('Elevated'),
    }),
    tokensUsed: ['--pf-card-bg', '--pf-card-border', '--pf-card-shadow-elevated'],
  }),
  seed('platform.paper', 'Paper', 'Surfaces', 'Generic paper surface container.', 'planned'),
  seed('platform.backdrop', 'Backdrop', 'Surfaces', 'Dimmed overlay layer behind modals.', 'stable', {
    propsSchema: objectSchema('Backdrop', {
      open: booleanSchema('Open'),
    }),
    tokensUsed: ['--pf-surface-overlay', '--pf-z-modal'],
  }),

  // Navigation
  seed('platform.bottomNavigation', 'BottomNavigation', 'Navigation', 'Mobile bottom navigation rail.', 'planned'),
  seed('platform.breadcrumbs', 'Breadcrumbs', 'Navigation', 'Hierarchical breadcrumb navigation.', 'stable', {
    propsSchema: objectSchema('Breadcrumbs', {
      separator: stringSchema('Separator'),
    }),
    tokensUsed: ['--pf-font-size-sm', '--pf-space-2'],
  }),
  seed('platform.drawer', 'Drawer', 'Navigation', 'Responsive side drawer.', 'stable', {
    propsSchema: objectSchema('Drawer', {
      side: stringEnumSchema('Side', ['left', 'right']),
      width: numberSchema('Width'),
    }),
    tokensUsed: ['--pf-drawer-width', '--pf-z-drawer', '--pf-surface-overlay'],
  }),
  seed('platform.link', 'Link', 'Navigation', 'Navigational text link.', 'planned'),
  seed('platform.menu', 'Menu', 'Navigation', 'Context menu and menu items.', 'stable', {
    propsSchema: objectSchema('Menu', {
      triggerLabel: stringSchema('Trigger Label'),
    }),
    tokensUsed: ['--pf-z-dropdown', '--pf-surface-layer'],
  }),
  seed('platform.menuItem', 'MenuItem', 'Navigation', 'Single selectable menu option.', 'stable', {
    propsSchema: objectSchema('Menu Item', {
      label: stringSchema('Label'),
      disabled: booleanSchema('Disabled'),
    }),
    tokensUsed: ['--pf-space-2', '--pf-surface-text'],
  }),
  seed('platform.pagination', 'Pagination', 'Navigation', 'Page navigation control.', 'stable', {
    propsSchema: objectSchema('Pagination', {
      count: numberSchema('Count'),
      page: numberSchema('Page'),
    }),
    tokensUsed: ['--pf-surface-border', '--pf-color-primary-500'],
  }),
  seed('platform.speedDial', 'SpeedDial', 'Navigation', 'Floating speed actions menu.', 'planned'),
  seed('platform.stepper', 'Stepper', 'Navigation', 'Progressive step navigation.', 'stable', {
    propsSchema: objectSchema('Stepper', {
      activeStep: numberSchema('Active Step'),
    }),
    tokensUsed: ['--pf-color-primary-500', '--pf-radius-full'],
  }),
  seed('platform.tabs', 'Tabs', 'Navigation', 'Tabbed navigation and content switching.', 'stable', {
    propsSchema: objectSchema('Tabs', {
      value: stringSchema('Value'),
    }),
    tokensUsed: ['--pf-space-3', '--pf-color-primary-500'],
  }),

  // Layout
  seed('platform.box', 'Box', 'Layout', 'Generic layout wrapper.', 'stable', {
    propsSchema: objectSchema('Box', {}),
    tokensUsed: ['--pf-space-4'],
  }),
  seed('platform.container', 'Container', 'Layout', 'Page width container with max-width presets.', 'stable', {
    propsSchema: objectSchema('Container', {
      maxWidth: stringSchema('Max Width'),
      fluid: booleanSchema('Fluid'),
    }),
    tokensUsed: ['--pf-screen-content-max', '--pf-space-6'],
  }),
  seed('platform.grid', 'Grid', 'Layout', 'Responsive CSS grid container.', 'stable', {
    propsSchema: objectSchema('Grid', {
      columns: numberSchema('Columns'),
      gap: numberSchema('Gap'),
    }),
    tokensUsed: ['--pf-grid-columns', '--pf-grid-gap'],
  }),
  seed('platform.stack', 'Stack', 'Layout', 'Vertical/horizontal stack layout helper.', 'stable', {
    propsSchema: objectSchema('Stack', {
      direction: stringEnumSchema('Direction', ['row', 'column']),
      gap: numberSchema('Gap'),
    }),
    tokensUsed: ['--pf-stack-gap'],
  }),
  seed('platform.masonry', 'Masonry', 'Layout', 'Masonry layout with variable row heights.', 'planned'),
  seed('platform.noSsr', 'NoSSR', 'Layout', 'Client-only rendering wrapper.', 'planned'),
  seed('platform.portal', 'Portal', 'Layout', 'Portal rendering for overlays.', 'planned'),

  // Utils
  seed('platform.clickAwayListener', 'ClickAwayListener', 'Utils', 'Utility for click-away dismissal behavior.', 'planned'),
  seed('platform.focusTrap', 'FocusTrap', 'Utils', 'Trap keyboard focus within an interactive region.', 'beta', {
    propsSchema: objectSchema('Focus Trap', {
      active: booleanSchema('Active'),
    }),
    tokensUsed: ['--pf-surface-focus'],
  }),
  seed('platform.popover', 'Popover', 'Utils', 'Anchored popover surface.', 'stable', {
    propsSchema: objectSchema('Popover', {
      open: booleanSchema('Open'),
      placement: stringEnumSchema('Placement', ['top', 'bottom', 'left', 'right']),
    }),
    tokensUsed: ['--pf-z-popover', '--pf-surface-layer', '--pf-shadow-md'],
  }),
  seed('platform.popper', 'Popper', 'Utils', 'Positioning engine wrapper for floating UI.', 'planned'),
  seed('platform.transitionFade', 'TransitionFade', 'Utils', 'Fade transition primitive.', 'planned'),
  seed('platform.transitionGrow', 'TransitionGrow', 'Utils', 'Grow transition primitive.', 'planned'),
  seed('platform.transitionCollapse', 'TransitionCollapse', 'Utils', 'Collapse transition primitive.', 'planned'),
  seed('platform.transitionSlide', 'TransitionSlide', 'Utils', 'Slide transition primitive.', 'planned'),

  // Existing external adapter examples
  seed('material.input', 'Text Input (Material Adapter)', 'External', 'Material adapter text input for compatibility.', 'stable', {
    propsSchema: objectSchema('Material input', {
      label: stringSchema('Label', 'Label text.'),
      placeholder: stringSchema('Placeholder', 'Placeholder text.'),
      helperText: stringSchema('Helper Text', 'Support text.'),
      inputType: stringEnumSchema('Input Type', ['text', 'number', 'email', 'date', 'datetime-local']),
    }),
    defaultProps: { label: 'Text field', placeholder: 'Type here...', inputType: 'text' },
    bindings: { data: ['value'] },
    tokensUsed: ['--pf-control-bg', '--pf-control-border-color'],
  }),
  seed('material.button', 'Button (Material Adapter)', 'External', 'Material adapter button for compatibility.', 'stable', {
    propsSchema: objectSchema('Material button', {
      label: stringSchema('Label', 'Button text.'),
    }),
    defaultProps: { label: 'Action button' },
    tokensUsed: ['--pf-button-radius', '--pf-button-shadow'],
  }),
  seed('aggrid.table', 'AG Grid Table', 'External', 'AG-Grid adapter table.', 'stable', {
    propsSchema: objectSchema('AG Grid table', {
      columns: arraySchema('Columns', objectSchema('Column', { field: stringSchema('Field') })),
    }),
    defaultProps: { columns: [{ field: 'id' }, { field: 'status' }], rows: [] },
    bindings: { data: ['rows'] },
    tokensUsed: ['--pf-table-border'],
  }),
  seed('highcharts.chart', 'Highcharts Chart', 'External', 'Highcharts adapter chart.', 'stable', {
    propsSchema: objectSchema('Chart', {
      title: stringSchema('Title', 'Chart title.'),
      series: arraySchema('Series', numberSchema('Point')),
    }),
    defaultProps: { title: 'Revenue', series: [2, 7, 4, 9] },
    bindings: { data: ['series'] },
    tokensUsed: ['--pf-color-primary-500'],
  }),
  seed('d3.custom', 'D3 Custom Visualization', 'External', 'D3 custom visualization adapter.', 'stable', {
    propsSchema: objectSchema('Custom chart', {
      height: numberSchema('Height', 80),
    }),
    defaultProps: { height: 240 },
    bindings: { data: ['dataset'] },
    tokensUsed: ['--pf-space-4'],
  }),
  seed('company.currencyInput', 'Currency Input (Company)', 'External', 'Company-specific currency component.', 'stable', {
    propsSchema: objectSchema('Currency input', {
      label: stringSchema('Label', 'Field label.'),
      currency: stringEnumSchema('Currency', ['USD', 'EUR', 'GBP']),
      min: numberSchema('Min'),
      max: numberSchema('Max'),
    }),
    defaultProps: { label: 'Amount', currency: 'USD' },
    bindings: { data: ['value'] },
    tokensUsed: ['--pf-control-bg', '--pf-control-radius'],
  }),
  seed('company.riskBadge', 'Risk Badge (Company)', 'External', 'Company-specific risk level badge.', 'stable', {
    propsSchema: objectSchema('Risk badge', {
      label: stringSchema('Label', 'Badge label.'),
      level: stringEnumSchema('Level', ['Low', 'Medium', 'High']),
    }),
    defaultProps: { label: 'Risk', level: 'Low' },
    bindings: { data: ['level'] },
    tokensUsed: ['--pf-color-warn-500', '--pf-color-error-500'],
  }),
];

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
    issues.push({ path: 'adapterHint', message: 'adapterHint should be namespaced (e.g. platform.textField)', severity: 'warning' });
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

  if (rec.status !== undefined && rec.status !== 'stable' && rec.status !== 'beta' && rec.status !== 'planned') {
    issues.push({ path: 'status', message: 'status must be stable|beta|planned', severity: 'error' });
  }

  if (rec.i18n !== undefined) {
    if (!isPlainObject(rec.i18n)) {
      issues.push({ path: 'i18n', message: 'i18n must be an object', severity: 'error' });
    } else {
      const i18n = rec.i18n as { nameKey?: unknown; descriptionKey?: unknown };
      if (typeof i18n.nameKey !== 'string' || i18n.nameKey.trim().length === 0) {
        issues.push({ path: 'i18n.nameKey', message: 'i18n.nameKey is required', severity: 'warning' });
      }
      if (typeof i18n.descriptionKey !== 'string' || i18n.descriptionKey.trim().length === 0) {
        issues.push({ path: 'i18n.descriptionKey', message: 'i18n.descriptionKey is required', severity: 'warning' });
      }
    }
  }

  if (rec.schemaSupport !== undefined && !isPlainObject(rec.schemaSupport)) {
    issues.push({ path: 'schemaSupport', message: 'schemaSupport must be an object', severity: 'error' });
  }

  return { valid: issues.filter((i) => i.severity === 'error').length === 0, issues };
}

export function builtinComponentDefinitions(): ComponentDefinition[] {
  return CATALOG_SEEDS.map(toDefinition);
}

export function mergeComponentDefinitions(
  base: ComponentDefinition[],
  overrides: ComponentDefinition[],
): ComponentDefinition[] {
  const byHint = new Map<string, ComponentDefinition>();
  for (const item of base) byHint.set(item.adapterHint, enrichComponentDefinition(item));
  for (const item of overrides) byHint.set(item.adapterHint, enrichComponentDefinition(item));
  return Array.from(byHint.values()).sort((a, b) => {
    const categoryCompare = (a.category || '').localeCompare(b.category || '');
    if (categoryCompare !== 0) return categoryCompare;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });
}

export function isPaletteComponentEnabled(definition: ComponentDefinition): boolean {
  return definition.status !== 'planned' && !definition.palette?.disabled;
}

export function enrichComponentDefinition(definition: ComponentDefinition): ComponentDefinition {
  const fallbackBase = `registry.components.${toKeySegment(definition.adapterHint)}`;
  const allowedProps = readSchemaPropertyKeys(definition.propsSchema);
  return {
    ...definition,
    status: definition.status ?? 'stable',
    i18n: definition.i18n ?? {
      nameKey: `${fallbackBase}.name`,
      descriptionKey: `${fallbackBase}.description`,
    },
    schemaSupport: {
      allowedProps,
      allowedBindings: {
        data: definition.bindings?.data ?? [],
        context: definition.bindings?.context ?? [],
        computed: definition.bindings?.computed ?? [],
      },
      supportsRules: COMMON_RULES,
      notes: definition.schemaSupport?.notes ?? [],
      ...(definition.schemaSupport ?? {}),
    },
    accessibility: {
      requiresI18nLabelKey: true,
      requirements: [
        'ariaLabelKey is required',
        'keyboard navigation support is required',
        'focusOrder must be unique and >= 1',
      ],
      ...(definition.accessibility ?? {}),
    },
    tokensUsed: definition.tokensUsed ?? [],
    palette: {
      disabled: definition.palette?.disabled ?? definition.status === 'planned',
      reason: definition.palette?.reason ?? (definition.status === 'planned' ? 'Not implemented yet' : undefined),
    },
  };
}

function seed(
  adapterHint: string,
  displayName: string,
  category: ComponentCategory,
  description: string,
  status: ComponentStatus,
  overrides?: {
    propsSchema?: JsonSchema;
    defaultProps?: Record<string, JSONValue>;
    bindings?: {
      data?: string[];
      context?: string[];
      computed?: string[];
    };
    accessibilityRequirements?: string[];
    tokensUsed?: string[];
  },
): SeedComponent {
  return {
    adapterHint,
    displayName,
    category,
    description,
    status,
    propsSchema: overrides?.propsSchema,
    defaultProps: overrides?.defaultProps,
    bindings: overrides?.bindings,
    accessibilityRequirements: overrides?.accessibilityRequirements,
    tokensUsed: overrides?.tokensUsed,
  };
}

function toDefinition(seedComponent: SeedComponent): ComponentDefinition {
  const keySegment = toKeySegment(seedComponent.adapterHint);
  const propsSchema = seedComponent.propsSchema ?? objectSchema(seedComponent.description, {});
  const schemaProps = readSchemaPropertyKeys(propsSchema);

  return {
    adapterHint: seedComponent.adapterHint,
    displayName: seedComponent.displayName,
    category: seedComponent.category,
    propsSchema,
    defaultProps: seedComponent.defaultProps,
    bindings: seedComponent.bindings,
    i18n: {
      nameKey: `registry.components.${keySegment}.name`,
      descriptionKey: `registry.components.${keySegment}.description`,
    },
    schemaSupport: {
      allowedProps: schemaProps,
      allowedBindings: {
        data: seedComponent.bindings?.data ?? [],
        context: seedComponent.bindings?.context ?? [],
        computed: seedComponent.bindings?.computed ?? [],
      },
      supportsRules: COMMON_RULES,
      notes: [
        seedComponent.status === 'planned'
          ? 'Planned component. Disabled in builder palette until implementation is available.'
          : 'Available in builder palette and runtime renderer.',
      ],
    },
    accessibility: {
      requiresI18nLabelKey: true,
      requirements: seedComponent.accessibilityRequirements ?? [
        'Provide ariaLabelKey via component.accessibility',
        'Component must be reachable by keyboard',
      ],
    },
    tokensUsed: seedComponent.tokensUsed ?? [],
    status: seedComponent.status,
    palette: {
      disabled: seedComponent.status === 'planned',
      reason: seedComponent.status === 'planned' ? 'Not implemented yet' : undefined,
    },
  };
}

function objectSchema(description: string, properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: 'object',
    description,
    properties,
    additionalProperties: true,
  };
}

function stringSchema(title: string, description?: string): JsonSchema {
  return {
    type: 'string',
    title,
    description,
  };
}

function stringEnumSchema(title: string, options: string[]): JsonSchema {
  return {
    type: 'string',
    title,
    enum: options,
  };
}

function numberSchema(title: string, minimum?: number): JsonSchema {
  return {
    type: 'number',
    title,
    minimum,
  };
}

function booleanSchema(title: string): JsonSchema {
  return {
    type: 'boolean',
    title,
  };
}

function arraySchema(title: string, items: JsonSchema): JsonSchema {
  return {
    type: 'array',
    title,
    items,
  };
}

function readSchemaPropertyKeys(schema: JsonSchema): string[] {
  if (!isPlainObject(schema)) return [];
  if (schema.type !== 'object') return [];
  return Object.keys(schema.properties ?? {}).sort((a, b) => a.localeCompare(b));
}

function toKeySegment(adapterHint: string): string {
  return adapterHint.replace(/[^a-zA-Z0-9]+/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
