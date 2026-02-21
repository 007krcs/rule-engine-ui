import type { JSONValue } from '@platform/schema';
import type {
  JSONSchema as PlatformJsonSchema,
  PlatformComponentAvailability,
  PlatformComponentCategory,
  PlatformComponentMeta,
} from '@platform/types';
export type {
  PlatformComponentMeta,
  PlatformComponentAvailability,
  PlatformComponentCategory,
} from '@platform/types';

export type RegistryScope = 'global' | 'tenant';

export type ComponentStatus = 'stable' | 'beta' | 'planned';
export type ComponentAvailability = PlatformComponentAvailability;

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

export type ComponentExample = {
  id: string;
  title: string;
  description: string;
  code: string;
};

export type ComponentDefinition = {
  id: string;
  adapterHint: string;
  displayName: string;
  description: string;
  category: ComponentCategory | string;
  propsSchema: JsonSchema;
  defaultProps?: Record<string, JSONValue>;
  examples?: ComponentExample[];
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
  availability: ComponentAvailability;
  supportsDrag: boolean;
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
  availability?: ComponentAvailability;
  propsSchema?: JsonSchema;
  defaultProps?: Record<string, JSONValue>;
  examples?: ComponentExample[];
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

const PLATFORM_IMPLEMENTED_COMPONENT_HINTS = new Set<string>([
  'platform.pageShell',
  'platform.section',
  'platform.splitLayout',
  'platform.toolbar',
  'platform.cardGrid',
  'platform.emptyState',
  'platform.button',
  'platform.textField',
  'platform.select',
  'platform.table',
  'platform.pagination',
  'platform.tabs',
  'platform.alert',
  'platform.avatar',
  'platform.badge',
  'platform.chip',
  'platform.divider',
  'platform.dateField',
  'platform.datePicker',
  'platform.timeField',
  'platform.timePicker',
  'platform.dateTimeField',
  'platform.calendar',
  'platform.clock',
]);

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
  seed('platform.button', 'Button', 'Inputs', 'Primary action button with intent, variant, and size controls.', 'stable', {
    propsSchema: objectSchema('Button', {
      labelKey: stringSchema('Label Key', 'Translation key for button text.'),
      variant: stringEnumSchema('Variant', ['solid', 'outline', 'ghost']),
      intent: stringEnumSchema('Intent', ['primary', 'secondary', 'neutral', 'success', 'warn', 'error']),
      size: stringEnumSchema('Size', ['sm', 'md', 'lg']),
      disabled: booleanSchema('Disabled'),
    }),
    defaultProps: {
      variant: 'solid',
      intent: 'primary',
      size: 'md',
    },
    bindings: { data: ['value'] },
    tokensUsed: ['--pf-color-primary-500', '--pf-space-3', '--pf-radius-md'],
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
  seed('platform.dateField', 'DateField', 'Inputs', 'Date input with locale preview and ISO date storage.', 'stable', {
    propsSchema: objectSchema('Date field', {
      label: stringSchema('Label'),
      helperText: stringSchema('Helper Text'),
      displayFormat: stringEnumSchema('Display Format', ['short', 'medium', 'long']),
      timezone: stringSchema('Timezone'),
      minDate: stringSchema('Min Date'),
      maxDate: stringSchema('Max Date'),
    }),
    defaultProps: {
      displayFormat: 'medium',
      timezone: 'UTC',
      defaultValue: '2026-01-01',
    },
    bindings: { data: ['valuePath'], context: ['locale', 'timezone'] },
    tokensUsed: ['--pf-control-height-md', '--pf-font-size-sm', '--pf-surface-border'],
  }),
  seed('platform.datePicker', 'DatePicker', 'Inputs', 'Date picker with calendar view and keyboard navigation.', 'stable', {
    propsSchema: objectSchema('Date picker', {
      label: stringSchema('Label'),
      helperText: stringSchema('Helper Text'),
      minDate: stringSchema('Min Date'),
      maxDate: stringSchema('Max Date'),
      displayFormat: stringEnumSchema('Display Format', ['short', 'medium', 'long']),
      showCalendar: booleanSchema('Show calendar'),
    }),
    defaultProps: {
      displayFormat: 'medium',
      showCalendar: true,
    },
    bindings: { data: ['valuePath'], context: ['locale', 'timezone'] },
    tokensUsed: ['--pf-control-height-md', '--pf-space-3', '--pf-color-primary-500'],
  }),
  seed('platform.timeField', 'TimeField', 'Inputs', 'Time input with step and min/max constraints.', 'stable', {
    propsSchema: objectSchema('Time field', {
      label: stringSchema('Label'),
      helperText: stringSchema('Helper Text'),
      step: numberSchema('Step (seconds)'),
      minTime: stringSchema('Min Time'),
      maxTime: stringSchema('Max Time'),
    }),
    defaultProps: {
      step: 300,
      timezone: 'UTC',
      defaultValue: '09:00',
    },
    bindings: { data: ['valuePath'], context: ['timezone'] },
    tokensUsed: ['--pf-control-height-md', '--pf-font-size-sm', '--pf-surface-border'],
  }),
  seed('platform.timePicker', 'TimePicker', 'Inputs', 'Time picker with clock surface and keyboard-friendly input.', 'stable', {
    propsSchema: objectSchema('Time picker', {
      label: stringSchema('Label'),
      helperText: stringSchema('Helper Text'),
      step: numberSchema('Step (seconds)'),
      minTime: stringSchema('Min Time'),
      maxTime: stringSchema('Max Time'),
      picker: booleanSchema('Show clock picker'),
      timezone: stringSchema('Timezone'),
    }),
    defaultProps: {
      step: 300,
      picker: true,
      timezone: 'UTC',
    },
    bindings: { data: ['valuePath'], context: ['timezone', 'locale'] },
    tokensUsed: ['--pf-control-height-md', '--pf-space-3', '--pf-color-primary-500'],
  }),
  seed('platform.dateTimeField', 'DateTimeField', 'Inputs', 'Date-time input for scheduling with ISO output.', 'stable', {
    propsSchema: objectSchema('Date time field', {
      label: stringSchema('Label'),
      helperText: stringSchema('Helper Text'),
      timezone: stringSchema('Timezone'),
      minDateTime: stringSchema('Min Date Time'),
      maxDateTime: stringSchema('Max Date Time'),
    }),
    defaultProps: {
      timezone: 'UTC',
      defaultValue: '2026-01-01T09:30',
    },
    bindings: { data: ['valuePath'], context: ['timezone', 'locale'] },
    tokensUsed: ['--pf-control-height-md', '--pf-font-size-sm', '--pf-surface-border'],
  }),
  seed('platform.calendar', 'Calendar', 'Inputs', 'Month calendar for date selection with keyboard navigation.', 'stable', {
    propsSchema: objectSchema('Calendar', {
      timezone: stringSchema('Timezone'),
      minDate: stringSchema('Min Date'),
      maxDate: stringSchema('Max Date'),
      disabledDates: arraySchema('Disabled Dates', stringSchema('ISO Date')),
    }),
    defaultProps: {
      timezone: 'UTC',
      defaultValue: '2026-01-01',
    },
    bindings: { data: ['valuePath'], context: ['locale', 'timezone'] },
    tokensUsed: ['--pf-surface-layer', '--pf-surface-border', '--pf-color-primary-500'],
  }),
  seed('platform.clock', 'Clock', 'Data Display', 'Digital clock display with optional time picker mode.', 'stable', {
    propsSchema: objectSchema('Clock', {
      timezone: stringSchema('Timezone'),
      picker: booleanSchema('Enable Picker'),
      showSeconds: booleanSchema('Show Seconds'),
    }),
    defaultProps: {
      timezone: 'UTC',
      picker: false,
      showSeconds: false,
      defaultValue: '09:00',
    },
    bindings: { data: ['valuePath'], context: ['timezone', 'locale'] },
    tokensUsed: ['--pf-font-size-2xl', '--pf-surface-border', '--pf-surface-text'],
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
      grouping: objectSchema('Grouping', {
        enabled: booleanSchema('Enabled'),
        keys: arraySchema('Keys', stringSchema('Key')),
      }),
      pivot: objectSchema('Pivot', {
        enabled: booleanSchema('Enabled'),
        rowKey: stringSchema('Row Key'),
        pivotKey: stringSchema('Pivot Key'),
        valueKey: stringSchema('Value Key'),
        aggregation: stringEnumSchema('Aggregation', ['sum', 'avg', 'min', 'max', 'count']),
      }),
      aggregation: objectSchema('Aggregation', {
        enabled: booleanSchema('Enabled'),
        config: objectSchema('Config', {
          field: stringSchema('Field'),
          type: stringEnumSchema('Type', ['sum', 'avg', 'min', 'max', 'count']),
        }),
      }),
    }),
    defaultProps: {
      grouping: { enabled: false, keys: [] },
      pivot: { enabled: false },
      aggregation: { enabled: false, config: {} },
    },
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
  seed('platform.map', 'Map', 'Data Display', 'Map component with layer controls and clustering.', 'beta', {
    propsSchema: objectSchema('Map', {
      mapLayers: arraySchema('Map Layers', objectSchema('Layer', {
        id: stringSchema('Id'),
        type: stringEnumSchema('Type', ['vector', 'geojson', 'heatmap', 'route']),
        source: stringSchema('Source'),
        visible: booleanSchema('Visible'),
      })),
      clusterEnabled: booleanSchema('Cluster Markers'),
      animationSpeed: numberSchema('Animation Speed', 0.1),
      projection: stringEnumSchema('Projection', ['mercator', 'globe']),
    }),
    defaultProps: {
      mapLayers: [{ id: 'base', type: 'vector', source: 'world', visible: true }],
      clusterEnabled: true,
      animationSpeed: 1,
      projection: 'mercator',
    },
    bindings: { data: ['markers', 'routes', 'geojson'] },
    tokensUsed: ['--pf-surface-layer', '--pf-color-primary-500'],
  }),
  seed('platform.mlDashboard', 'ML Dashboard', 'Data Display', 'Model explainability surface with local/global contribution views.', 'beta', {
    propsSchema: objectSchema('ML Dashboard', {
      modelId: stringSchema('Model Id'),
      explanationMode: stringEnumSchema('Explanation Mode', ['local', 'global']),
    }),
    defaultProps: {
      modelId: 'credit-risk-v1',
      explanationMode: 'local',
    },
    bindings: { data: ['predictionTraces', 'modelMetadata'] },
    tokensUsed: ['--pf-surface-layer', '--pf-color-primary-500'],
  }),

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
      open: booleanSchema('Open'),
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
  seed('platform.toolbar', 'Toolbar', 'Layout', 'Horizontal action row for filters, search, and commands.', 'stable', {
    propsSchema: objectSchema('Toolbar', {
      align: stringEnumSchema('Align', ['left', 'right', 'space-between']),
      wrap: booleanSchema('Wrap'),
      density: stringEnumSchema('Density', ['comfortable', 'compact']),
    }),
    defaultProps: {
      align: 'space-between',
      wrap: true,
      density: 'comfortable',
    },
    tokensUsed: ['--pf-space-3', '--pf-control-height-lg', '--pf-surface-border'],
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
  seed('platform.pageShell', 'PageShell', 'Layout', 'Full-page shell with header, sidebar, content, and optional right panel.', 'stable', {
    propsSchema: objectSchema('Page shell', {
      sidebarWidth: numberSchema('Sidebar Width'),
      collapsedSidebarWidth: numberSchema('Collapsed Sidebar Width'),
      hasRightPanel: booleanSchema('Has Right Panel'),
      headerHeight: numberSchema('Header Height'),
      stickyHeader: booleanSchema('Sticky Header'),
    }),
    defaultProps: {
      sidebarWidth: 280,
      collapsedSidebarWidth: 84,
      hasRightPanel: false,
      headerHeight: 64,
      stickyHeader: true,
    },
    bindings: { data: ['sidebarItems', 'rightPanelItems'], context: ['device'] },
    tokensUsed: ['--pf-page-shell-header-height', '--pf-page-shell-sidebar-width', '--pf-surface-layer'],
  }),
  seed('platform.section', 'Section', 'Layout', 'Content block with title, plain-language description, and optional actions.', 'stable', {
    propsSchema: objectSchema('Section', {
      titleKey: stringSchema('Title Key'),
      descriptionKey: stringSchema('Description Key'),
      intent: stringEnumSchema('Intent', ['neutral', 'info', 'warn']),
    }),
    bindings: { data: ['items'] },
    tokensUsed: ['--pf-space-4', '--pf-surface-border', '--pf-radius-lg'],
  }),
  seed('platform.splitLayout', 'SplitLayout', 'Layout', 'Two-column responsive split with adjustable ratio.', 'stable', {
    propsSchema: objectSchema('Split layout', {
      leftWidthPercent: numberSchema('Left Width Percent'),
      gap: numberSchema('Gap'),
      stackOnMobile: booleanSchema('Stack on Mobile'),
    }),
    defaultProps: {
      leftWidthPercent: 40,
      gap: 16,
      stackOnMobile: true,
    },
    bindings: { data: ['leftItems', 'rightItems'] },
    tokensUsed: ['--pf-split-left-percent', '--pf-split-gap'],
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
  seed('platform.cardGrid', 'CardGrid', 'Layout', 'Responsive grid of cards for dashboards, files, and summaries.', 'stable', {
    propsSchema: objectSchema('Card grid', {
      columns: objectSchema('Columns', {
        sm: numberSchema('SM Columns'),
        md: numberSchema('MD Columns'),
        lg: numberSchema('LG Columns'),
        xl: numberSchema('XL Columns'),
      }),
      gap: numberSchema('Gap'),
    }),
    defaultProps: {
      columns: { sm: 1, md: 2, lg: 3, xl: 4 },
      gap: 16,
    },
    bindings: { data: ['items'] },
    tokensUsed: ['--pf-card-grid-cols-lg', '--pf-card-grid-gap'],
  }),
  seed('platform.emptyState', 'EmptyState', 'Layout', 'Guided empty-state with title, help text, and action CTA.', 'stable', {
    propsSchema: objectSchema('Empty state', {
      icon: stringSchema('Icon'),
      titleKey: stringSchema('Title Key'),
      descriptionKey: stringSchema('Description Key'),
      actionLabelKey: stringSchema('Action Label Key'),
    }),
    bindings: { data: ['actionPath'] },
    tokensUsed: ['--pf-radius-lg', '--pf-color-primary-100', '--pf-surface-border'],
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
      indicators: arraySchema('Indicators', objectSchema('Indicator', {
        type: stringEnumSchema('Type', ['SMA', 'EMA', 'RSI', 'MACD', 'BOLLINGER']),
        period: numberSchema('Period', 1),
        fastPeriod: numberSchema('Fast Period', 1),
        slowPeriod: numberSchema('Slow Period', 1),
        signalPeriod: numberSchema('Signal Period', 1),
        stdDev: numberSchema('Std Dev', 1),
      })),
      multiAxis: objectSchema('Multi-axis', {
        enabled: booleanSchema('Enabled'),
        leftTitle: stringSchema('Left Axis Title'),
        rightTitle: stringSchema('Right Axis Title'),
      }),
      overlays: arraySchema('Overlays', objectSchema('Overlay', {
        id: stringSchema('Id'),
        type: stringEnumSchema('Type', ['line', 'area', 'band']),
        axis: stringEnumSchema('Axis', ['left', 'right']),
        color: stringSchema('Color'),
      })),
    }),
    defaultProps: {
      title: 'Revenue',
      series: [2, 7, 4, 9],
      indicators: [{ type: 'SMA', period: 3 }],
      multiAxis: { enabled: false },
      overlays: [],
    },
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
  const id = typeof rec.id === 'string' ? rec.id.trim() : '';
  if (!id) {
    issues.push({ path: 'id', message: 'id is required', severity: 'error' });
  }
  const adapterHint = typeof rec.adapterHint === 'string' ? rec.adapterHint.trim() : '';
  if (!adapterHint) {
    issues.push({ path: 'adapterHint', message: 'adapterHint is required', severity: 'error' });
  }
  if (id && adapterHint && id !== adapterHint) {
    issues.push({
      path: 'id',
      message: 'id should match adapterHint to preserve lifecycle consistency',
      severity: 'warning',
    });
  }
  if (adapterHint && !adapterHint.includes('.')) {
    issues.push({ path: 'adapterHint', message: 'adapterHint should be namespaced (e.g. platform.textField)', severity: 'warning' });
  }

  const displayName = typeof rec.displayName === 'string' ? rec.displayName.trim() : '';
  if (!displayName) {
    issues.push({ path: 'displayName', message: 'displayName is required', severity: 'error' });
  }

  const description = typeof rec.description === 'string' ? rec.description.trim() : '';
  if (!description) {
    issues.push({ path: 'description', message: 'description is recommended', severity: 'warning' });
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
  if (rec.availability === undefined) {
    issues.push({
      path: 'availability',
      message: 'availability is required and must be implemented|planned|external',
      severity: 'error',
    });
  } else if (
    rec.availability !== 'implemented' &&
    rec.availability !== 'planned' &&
    rec.availability !== 'external'
  ) {
    issues.push({
      path: 'availability',
      message: 'availability must be implemented|planned|external',
      severity: 'error',
    });
  }
  if (rec.supportsDrag !== undefined && typeof rec.supportsDrag !== 'boolean') {
    issues.push({
      path: 'supportsDrag',
      message: 'supportsDrag must be a boolean when provided',
      severity: 'error',
    });
  }
  if (
    rec.availability !== undefined &&
    rec.supportsDrag === true &&
    rec.availability !== 'implemented'
  ) {
    issues.push({
      path: 'supportsDrag',
      message: 'supportsDrag must be false when availability is planned or external',
      severity: 'error',
    });
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

export function listImplemented(
  definitions: ComponentDefinition[] = builtinComponentDefinitions(),
): ComponentDefinition[] {
  return definitions
    .map((definition) => enrichComponentDefinition(definition))
    .filter((definition) => definition.availability === 'implemented' && definition.supportsDrag);
}

export function isImplemented(
  adapterHint: string,
  definitions: ComponentDefinition[] = builtinComponentDefinitions(),
): boolean {
  return listImplemented(definitions).some((definition) => definition.adapterHint === adapterHint);
}

export function toPlatformComponentMeta(definition: ComponentDefinition): PlatformComponentMeta {
  const enriched = enrichComponentDefinition(definition);
  return {
    id: enriched.adapterHint,
    category: mapToPlatformCategory(enriched.category),
    availability: enriched.availability,
    propsSchema: enriched.propsSchema as PlatformJsonSchema,
    supportsDrag: enriched.supportsDrag,
  };
}

export function listPlatformComponentMeta(
  definitions: ComponentDefinition[] = builtinComponentDefinitions(),
): PlatformComponentMeta[] {
  return definitions.map((definition) => toPlatformComponentMeta(definition));
}

export function adapterPrefixFromHint(adapterHint: string): string {
  const prefix = adapterHint.split('.')[0]?.trim();
  return prefix ? `${prefix}.` : '';
}

export function isPaletteComponentEnabled(
  definition: ComponentDefinition,
  input?: {
    enabledAdapterPrefixes?: Iterable<string>;
  },
): boolean {
  const enriched = enrichComponentDefinition(definition);
  if (enriched.availability === 'external') {
    if (!input?.enabledAdapterPrefixes) return false;
    const enabledPrefixes = new Set(input.enabledAdapterPrefixes);
    return enabledPrefixes.has(adapterPrefixFromHint(enriched.adapterHint));
  }
  if (enriched.availability !== 'implemented') return false;
  if (!enriched.supportsDrag) return false;
  return !enriched.palette?.disabled;
}

export function enrichComponentDefinition(definition: ComponentDefinition): ComponentDefinition {
  const fallbackBase = `registry.components.${toKeySegment(definition.adapterHint)}`;
  const allowedProps = readSchemaPropertyKeys(definition.propsSchema);
  const availability =
    definition.availability ?? inferAvailability(definition.adapterHint, definition.status ?? 'stable');
  const supportsDrag = availability === 'implemented' && (definition.supportsDrag ?? true);
  return {
    ...definition,
    id: definition.id || definition.adapterHint,
    description: definition.description || definition.propsSchema.description || definition.displayName,
    examples: definition.examples?.length
      ? definition.examples
      : [createDefaultExample(definition.adapterHint, definition.displayName, definition.defaultProps)],
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
    availability,
    supportsDrag,
    palette: {
      disabled: definition.palette?.disabled ?? !supportsDrag,
      reason:
        definition.palette?.reason ??
        (availability === 'planned'
          ? 'Not implemented yet'
          : availability === 'external'
            ? 'Requires external adapter'
            : undefined),
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
    availability?: ComponentAvailability;
    propsSchema?: JsonSchema;
    defaultProps?: Record<string, JSONValue>;
    examples?: ComponentExample[];
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
    availability: overrides?.availability,
    propsSchema: overrides?.propsSchema,
    defaultProps: overrides?.defaultProps,
    examples: overrides?.examples,
    bindings: overrides?.bindings,
    accessibilityRequirements: overrides?.accessibilityRequirements,
    tokensUsed: overrides?.tokensUsed,
  };
}

function toDefinition(seedComponent: SeedComponent): ComponentDefinition {
  const keySegment = toKeySegment(seedComponent.adapterHint);
  const propsSchema = seedComponent.propsSchema ?? objectSchema(seedComponent.description, {});
  const schemaProps = readSchemaPropertyKeys(propsSchema);
  const availability = seedComponent.availability ?? inferAvailability(seedComponent.adapterHint, seedComponent.status);
  const supportsDrag = availability === 'implemented';

  return {
    id: seedComponent.adapterHint,
    adapterHint: seedComponent.adapterHint,
    displayName: seedComponent.displayName,
    description: seedComponent.description,
    category: seedComponent.category,
    propsSchema,
    defaultProps: seedComponent.defaultProps,
    examples:
      seedComponent.examples && seedComponent.examples.length > 0
        ? seedComponent.examples
        : [createDefaultExample(seedComponent.adapterHint, seedComponent.displayName, seedComponent.defaultProps)],
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
        availability === 'planned'
          ? 'Planned component. Disabled in builder palette until implementation is available.'
          : availability === 'external'
            ? 'Provided by optional adapter integration.'
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
    availability,
    supportsDrag,
    palette: {
      disabled: !supportsDrag,
      reason:
        availability === 'planned'
          ? 'Not implemented yet'
          : availability === 'external'
            ? 'Requires external adapter'
            : undefined,
    },
  };
}

function inferAvailability(
  adapterHint: string,
  status: ComponentStatus,
): ComponentAvailability {
  if (!adapterHint.startsWith('platform.')) return 'external';
  if (status === 'planned') return 'planned';
  return PLATFORM_IMPLEMENTED_COMPONENT_HINTS.has(adapterHint) ? 'implemented' : 'planned';
}

function mapToPlatformCategory(category: ComponentCategory | string): PlatformComponentCategory {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes('input')) return 'input';
  if (normalized.includes('layout')) return 'layout';
  if (normalized.includes('navigation')) return 'navigation';
  if (normalized.includes('feedback')) return 'feedback';
  return 'display';
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

function createDefaultExample(
  adapterHint: string,
  displayName: string,
  defaultProps?: Record<string, JSONValue>,
): ComponentExample {
  return {
    id: `${toKeySegment(adapterHint)}.basic`,
    title: `Basic ${displayName}`,
    description: `Baseline ${displayName} configuration.`,
    code: buildExampleCode(adapterHint, defaultProps),
  };
}

function buildExampleCode(
  adapterHint: string,
  defaultProps?: Record<string, JSONValue>,
): string {
  const componentName = toUiKitComponentName(adapterHint);
  if (!componentName) {
    return `// ${adapterHint} is provided by adapter integration.\n// Register an adapter and render via schema.`;
  }
  const props = defaultProps ?? {};
  const propEntries = Object.entries(props);
  if (propEntries.length === 0) {
    return `<${componentName} />`;
  }
  const serializedProps = propEntries
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}={${JSON.stringify(value)}}`)
    .join('\n  ');
  return `<${componentName}\n  ${serializedProps}\n/>`;
}

function toUiKitComponentName(adapterHint: string): string | null {
  const name = adapterHint.split('.')[1] ?? '';
  if (!name || adapterHint.startsWith('material.') || adapterHint.startsWith('aggrid.') || adapterHint.startsWith('highcharts.') || adapterHint.startsWith('d3.') || adapterHint.startsWith('company.')) {
    return null;
  }
  return `PF${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function toKeySegment(adapterHint: string): string {
  return adapterHint.replace(/[^a-zA-Z0-9]+/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
