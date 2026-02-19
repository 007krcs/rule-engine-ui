import type { ComponentContract } from '@platform/component-contract';

export type ComponentCatalogEntry = ComponentContract;

type TextInputProps = {
  label?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  ariaLabel?: string;
};

type StatusBadgeProps = {
  label?: string;
  tone?: string;
  ariaLabel?: string;
};

type StackLayoutProps = {
  gap?: number;
  direction?: string;
};

type ButtonProps = {
  label?: string;
  variant?: string;
  intent?: string;
  ariaLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
};

type DatePickerProps = {
  label?: string;
  locale?: string;
  dateFormat?: string;
  useNative?: boolean;
  minDate?: string;
  maxDate?: string;
  ariaLabel?: string;
};

type CurrencyInputProps = {
  label?: string;
  locale?: string;
  currency?: string;
  fractionDigits?: number;
  ariaLabel?: string;
};

type OTPInputProps = {
  length?: number;
  label?: string;
  ariaLabel?: string;
};

type IBANInputProps = {
  label?: string;
  countryCode?: string;
  validateOnBlur?: boolean;
  ariaLabel?: string;
};

type StepperProps = {
  steps?: Array<{ label: string; description?: string }>;
  currentStep?: number;
  orientation?: string;
  ariaLabel?: string;
};

type TableProps = {
  columns?: Array<{ key: string; title: string; sortable?: boolean }>;
  data?: Array<Record<string, unknown>>;
  pageSize?: number;
  ariaLabel?: string;
};

type ChartProps = {
  type?: string;
  data?: Array<{ x: string | number; y: number }>;
  showGrid?: boolean;
  ariaLabel?: string;
};

const defaultCatalog: ComponentCatalogEntry[] = [
  {
    type: 'action.button',
    displayName: 'Button',
    category: 'Form Controls',
    description: 'Primary action button for user interactions.',
    icon: 'button',
    adapterHint: 'native.action.button',
    props: {
      label: {
        kind: 'string',
        label: 'Label',
        description: 'Text shown inside the button.',
        defaultValue: 'Continue',
      },
      variant: {
        kind: 'enum',
        label: 'Variant',
        description: 'Visual style for the button.',
        options: [
          { value: 'primary', label: 'Primary' },
          { value: 'secondary', label: 'Secondary' },
          { value: 'ghost', label: 'Ghost' },
          { value: 'danger', label: 'Danger' },
        ],
        defaultValue: 'primary',
      },
      intent: {
        kind: 'enum',
        label: 'Intent',
        description: 'Semantic intent of the action.',
        options: [
          { value: 'primary', label: 'Primary' },
          { value: 'success', label: 'Success' },
          { value: 'warning', label: 'Warning' },
          { value: 'danger', label: 'Danger' },
        ],
        defaultValue: 'primary',
      },
      ariaLabel: {
        kind: 'string',
        label: 'ARIA Label',
        description: 'Assistive label for icon-only buttons.',
        defaultValue: '',
      },
      disabled: {
        kind: 'boolean',
        label: 'Disabled',
        description: 'Disables the button interaction.',
        defaultValue: false,
      },
      loading: {
        kind: 'boolean',
        label: 'Loading',
        description: 'Shows a loading indicator and disables the button.',
        defaultValue: false,
      },
      fullWidth: {
        kind: 'boolean',
        label: 'Full Width',
        description: 'Expand the button to fill its container.',
        defaultValue: false,
      },
    },
    defaultProps: {
      label: 'Continue',
      variant: 'primary',
      intent: 'primary',
      disabled: false,
      loading: false,
      fullWidth: false,
    } satisfies Partial<ButtonProps>,
    bindings: [
      {
        key: 'data',
        kind: 'data',
        description: 'Dataset for table rows.',
      },
    ],
    events: [
      {
        name: 'onClick',
        description: 'Emitted when the button is clicked.',
      },
    ],
    accessibility: {
      role: 'button',
      requiredProps: ['ariaLabel'],
    },
    documentation: {
      summary: 'Trigger actions or submit flows.',
      tips: ['Use ariaLabel when rendering icon-only buttons.'],
    },
  },
  {
    type: 'input.text',
    displayName: 'Text Input',
    category: 'Form Controls',
    description: 'Single-line text input that binds to a data value.',
    icon: 'text',
    adapterHint: 'native.input.text',
    props: {
      label: {
        kind: 'string',
        label: 'Label',
        description: 'Field label shown above the input.',
        defaultValue: 'Text Input',
      },
      placeholder: {
        kind: 'string',
        label: 'Placeholder',
        description: 'Placeholder text shown inside the input.',
        defaultValue: '',
      },
      required: {
        kind: 'boolean',
        label: 'Required',
        description: 'Marks the field as required.',
        defaultValue: false,
      },
      maxLength: {
        kind: 'number',
        label: 'Max Length',
        description: 'Maximum number of characters.',
        min: 0,
      },
      ariaLabel: {
        kind: 'string',
        label: 'ARIA Label',
        description: 'Assistive label for screen readers.',
        defaultValue: '',
      },
    },
    defaultProps: {
      label: 'Text Input',
      placeholder: '',
      required: false,
    } satisfies Partial<TextInputProps>,
    bindings: [
      {
        key: 'value',
        kind: 'data',
        description: 'Data path for the field value.',
        required: true,
      },
    ],
    events: [
      {
        name: 'onChange',
        description: 'Emitted when the input value changes.',
      },
    ],
    validation: {
      supports: ['required', 'maxLength'],
    },
    accessibility: {
      role: 'textbox',
      requiredProps: ['ariaLabel'],
      notes: ['Ensure labels are provided for screen readers.'],
    },
    documentation: {
      summary: 'Basic text input for forms and data entry.',
      tips: ['Bind value to a data path in the schema.'],
      examples: ['Use for names, emails, or short answers.'],
    },
  },
  {
    type: 'input.date',
    displayName: 'Date Picker',
    category: 'Form Controls',
    description: 'Locale-aware date input with optional native picker.',
    icon: 'calendar',
    adapterHint: 'native.input.date',
    props: {
      label: {
        kind: 'string',
        label: 'Label',
        description: 'Field label shown above the picker.',
        defaultValue: 'Date',
      },
      locale: {
        kind: 'string',
        label: 'Locale',
        description: 'Locale override (for example, en-US or fr-FR).',
        defaultValue: '',
      },
      dateFormat: {
        kind: 'string',
        label: 'Date Format',
        description: 'Custom format pattern like MM/dd/yyyy.',
        defaultValue: '',
      },
      useNative: {
        kind: 'boolean',
        label: 'Use Native Picker',
        description: 'Use the browser native date picker when available.',
        defaultValue: true,
      },
      minDate: {
        kind: 'string',
        label: 'Min Date',
        description: 'Lower date bound in YYYY-MM-DD format.',
      },
      maxDate: {
        kind: 'string',
        label: 'Max Date',
        description: 'Upper date bound in YYYY-MM-DD format.',
      },
      ariaLabel: {
        kind: 'string',
        label: 'ARIA Label',
        description: 'Assistive label when no visual label exists.',
        defaultValue: '',
      },
    },
    defaultProps: {
      label: 'Date',
      useNative: true,
    } satisfies Partial<DatePickerProps>,
    bindings: [
      {
        key: 'selectedDate',
        kind: 'data',
        description: 'Bound date value.',
      },
    ],
    events: [
      {
        name: 'onDateChange',
        description: 'Emitted when the date changes.',
      },
    ],
    accessibility: {
      role: 'textbox',
      recommendedProps: ['ariaLabel'],
    },
    documentation: {
      summary: 'Localized date input with optional native UI.',
    },
  },
  {
    type: 'input.currency',
    displayName: 'Currency Input',
    category: 'Form Controls',
    description: 'Localized currency input with inline formatting.',
    icon: 'currency',
    adapterHint: 'native.input.currency',
    props: {
      label: {
        kind: 'string',
        label: 'Label',
        description: 'Field label shown above the input.',
        defaultValue: 'Amount',
      },
      locale: {
        kind: 'string',
        label: 'Locale',
        description: 'Locale override for number formatting.',
        defaultValue: '',
      },
      currency: {
        kind: 'string',
        label: 'Currency',
        description: 'ISO currency code such as USD or EUR.',
        defaultValue: 'USD',
      },
      fractionDigits: {
        kind: 'number',
        label: 'Fraction Digits',
        description: 'Number of decimal places to display.',
        min: 0,
      },
      ariaLabel: {
        kind: 'string',
        label: 'ARIA Label',
        description: 'Assistive label when no visual label exists.',
        defaultValue: '',
      },
    },
    defaultProps: {
      label: 'Amount',
      currency: 'USD',
      fractionDigits: 2,
    } satisfies Partial<CurrencyInputProps>,
    bindings: [
      {
        key: 'value',
        kind: 'data',
        description: 'Bound numeric value.',
        required: true,
      },
    ],
    events: [
      {
        name: 'onValueChange',
        description: 'Emitted when the numeric value changes.',
      },
    ],
    accessibility: {
      role: 'textbox',
      recommendedProps: ['ariaLabel'],
    },
    documentation: {
      summary: 'Formats numbers as localized currency on blur.',
    },
  },
  {
    type: 'input.otp',
    displayName: 'OTP Input',
    category: 'Form Controls',
    description: 'One-time password input with auto-advance.',
    icon: 'otp',
    adapterHint: 'native.input.otp',
    props: {
      label: {
        kind: 'string',
        label: 'Label',
        description: 'Field label shown above the inputs.',
        defaultValue: 'Verification Code',
      },
      length: {
        kind: 'number',
        label: 'Length',
        description: 'Number of digits in the OTP.',
        min: 4,
        max: 12,
        defaultValue: 6,
      },
      ariaLabel: {
        kind: 'string',
        label: 'ARIA Label',
        description: 'Assistive label for the OTP group.',
        defaultValue: '',
      },
    },
    defaultProps: {
      label: 'Verification Code',
      length: 6,
    } satisfies Partial<OTPInputProps>,
    bindings: [
      {
        key: 'data',
        kind: 'data',
        description: 'Dataset for chart points.',
      },
    ],
    events: [
      {
        name: 'onComplete',
        description: 'Emitted when all digits are entered.',
      },
    ],
    accessibility: {
      role: 'group',
      recommendedProps: ['ariaLabel'],
    },
    documentation: {
      summary: 'Secure OTP entry with automatic focus management.',
    },
  },
  {
    type: 'input.iban',
    displayName: 'IBAN Input',
    category: 'Form Controls',
    description: 'International Bank Account Number input with validation.',
    icon: 'iban',
    adapterHint: 'native.input.iban',
    props: {
      label: {
        kind: 'string',
        label: 'Label',
        description: 'Field label shown above the input.',
        defaultValue: 'IBAN',
      },
      countryCode: {
        kind: 'string',
        label: 'Country Code',
        description: 'Optional country code to enforce length rules.',
        defaultValue: '',
      },
      validateOnBlur: {
        kind: 'boolean',
        label: 'Validate On Blur',
        description: 'Show validation feedback on blur.',
        defaultValue: true,
      },
      ariaLabel: {
        kind: 'string',
        label: 'ARIA Label',
        description: 'Assistive label when no visual label exists.',
        defaultValue: '',
      },
    },
    defaultProps: {
      label: 'IBAN',
      validateOnBlur: true,
    } satisfies Partial<IBANInputProps>,
    bindings: [
      {
        key: 'value',
        kind: 'data',
        description: 'Bound IBAN value.',
      },
    ],
    events: [
      {
        name: 'onValueChange',
        description: 'Emitted when the IBAN value changes.',
      },
    ],
    accessibility: {
      role: 'textbox',
      recommendedProps: ['ariaLabel'],
    },
    documentation: {
      summary: 'Formats and validates IBAN entries.',
    },
  },
  {
    type: 'display.badge',
    displayName: 'Status Badge',
    category: 'Data Display',
    description: 'Small pill used to represent status or category.',
    icon: 'badge',
    adapterHint: 'native.display.badge',
    props: {
      label: {
        kind: 'string',
        label: 'Label',
        description: 'Text shown inside the badge.',
        defaultValue: 'Status',
      },
      tone: {
        kind: 'enum',
        label: 'Tone',
        description: 'Color tone for the badge.',
        options: [
          { value: 'neutral', label: 'Neutral' },
          { value: 'success', label: 'Success' },
          { value: 'warning', label: 'Warning' },
          { value: 'danger', label: 'Danger' },
        ],
        defaultValue: 'neutral',
      },
      ariaLabel: {
        kind: 'string',
        label: 'ARIA Label',
        description: 'Assistive label for the badge.',
        defaultValue: '',
      },
    },
    defaultProps: {
      label: 'Status',
      tone: 'neutral',
    } satisfies Partial<StatusBadgeProps>,
    bindings: [
      {
        key: 'label',
        kind: 'data',
        description: 'Data path for the badge label.',
      },
    ],
    events: [],
    accessibility: {
      role: 'status',
      recommendedProps: ['ariaLabel'],
    },
    documentation: {
      summary: 'Use to show quick status summaries in dashboards.',
      tips: ['Keep the label short for best readability.'],
    },
  },
  {
    type: 'display.table',
    displayName: 'Data Table',
    category: 'Data Display',
    description: 'Sortable table for structured datasets.',
    icon: 'table',
    adapterHint: 'native.display.table',
    props: {
      columns: {
        kind: 'json',
        label: 'Columns',
        description: 'Column definitions for the table.',
        editable: false,
        defaultValue: [
          { key: 'name', title: 'Name', sortable: true },
          { key: 'status', title: 'Status' },
        ],
      },
      data: {
        kind: 'json',
        label: 'Rows',
        description: 'Row data for the table.',
        editable: false,
        defaultValue: [
          { name: 'Acme Corp', status: 'Active' },
          { name: 'Globex', status: 'Pending' },
          { name: 'Initech', status: 'On Hold' },
        ],
      },
      pageSize: {
        kind: 'number',
        label: 'Page Size',
        description: 'Number of rows to render per page.',
        min: 1,
        defaultValue: 10,
      },
      ariaLabel: {
        kind: 'string',
        label: 'ARIA Label',
        description: 'Assistive label for the table.',
        defaultValue: '',
      },
    },
    defaultProps: {
      columns: [
        { key: 'name', title: 'Name', sortable: true },
        { key: 'status', title: 'Status' },
      ],
      data: [
        { name: 'Acme Corp', status: 'Active' },
        { name: 'Globex', status: 'Pending' },
      ],
      pageSize: 10,
    } satisfies Partial<TableProps>,
    bindings: [],
    events: [
      {
        name: 'onRowClick',
        description: 'Emitted when a row is clicked.',
      },
    ],
    accessibility: {
      role: 'table',
      recommendedProps: ['ariaLabel'],
    },
    documentation: {
      summary: 'Displays structured data with optional sorting.',
    },
  },
  {
    type: 'display.chart',
    displayName: 'Chart',
    category: 'Data Display',
    description: 'Basic bar or line chart rendered with SVG.',
    icon: 'chart',
    adapterHint: 'native.display.chart',
    props: {
      type: {
        kind: 'enum',
        label: 'Type',
        description: 'Chart visualization style.',
        options: [
          { value: 'bar', label: 'Bar' },
          { value: 'line', label: 'Line' },
        ],
        defaultValue: 'bar',
      },
      data: {
        kind: 'json',
        label: 'Data',
        description: 'Series data points for the chart.',
        editable: false,
        defaultValue: [
          { x: 'Q1', y: 42 },
          { x: 'Q2', y: 68 },
          { x: 'Q3', y: 55 },
          { x: 'Q4', y: 75 },
        ],
      },
      showGrid: {
        kind: 'boolean',
        label: 'Show Grid',
        description: 'Show baseline/grid for orientation.',
        defaultValue: true,
      },
      ariaLabel: {
        kind: 'string',
        label: 'ARIA Label',
        description: 'Assistive label for the chart.',
        defaultValue: '',
      },
    },
    defaultProps: {
      type: 'bar',
      showGrid: true,
      data: [
        { x: 'Q1', y: 42 },
        { x: 'Q2', y: 68 },
        { x: 'Q3', y: 55 },
        { x: 'Q4', y: 75 },
      ],
    } satisfies Partial<ChartProps>,
    bindings: [],
    events: [],
    accessibility: {
      role: 'img',
      recommendedProps: ['ariaLabel'],
    },
    documentation: {
      summary: 'Lightweight charting for dashboards and summaries.',
    },
  },
  {
    type: 'layout.stack',
    displayName: 'Stack Layout',
    category: 'Layout',
    description: 'Arranges children in a vertical or horizontal stack.',
    icon: 'stack',
    adapterHint: 'native.layout.stack',
    props: {
      gap: {
        kind: 'number',
        label: 'Gap',
        description: 'Spacing between children (px).',
        min: 0,
        defaultValue: 16,
      },
      direction: {
        kind: 'enum',
        label: 'Direction',
        description: 'Direction to stack items.',
        options: [
          { value: 'row', label: 'Row' },
          { value: 'column', label: 'Column' },
        ],
        defaultValue: 'column',
      },
    },
    defaultProps: {
      gap: 16,
      direction: 'column',
    } satisfies Partial<StackLayoutProps>,
    bindings: [],
    events: [],
    documentation: {
      summary: 'Layout primitive for linear stacking.',
    },
  },
  {
    type: 'navigation.stepper',
    displayName: 'Stepper',
    category: 'Navigation',
    description: 'Progress indicator for multi-step flows.',
    icon: 'stepper',
    adapterHint: 'native.navigation.stepper',
    props: {
      steps: {
        kind: 'json',
        label: 'Steps',
        description: 'Step labels and descriptions.',
        editable: false,
        defaultValue: [
          { label: 'Profile' },
          { label: 'Verification' },
          { label: 'Confirm' },
        ],
      },
      currentStep: {
        kind: 'number',
        label: 'Current Step',
        description: 'Index of the active step.',
        min: 0,
        defaultValue: 0,
      },
      orientation: {
        kind: 'enum',
        label: 'Orientation',
        description: 'Horizontal or vertical layout.',
        options: [
          { value: 'horizontal', label: 'Horizontal' },
          { value: 'vertical', label: 'Vertical' },
        ],
        defaultValue: 'horizontal',
      },
      ariaLabel: {
        kind: 'string',
        label: 'ARIA Label',
        description: 'Assistive label for the stepper.',
        defaultValue: '',
      },
    },
    defaultProps: {
      steps: [{ label: 'Profile' }, { label: 'Verification' }, { label: 'Confirm' }],
      currentStep: 0,
      orientation: 'horizontal',
    } satisfies Partial<StepperProps>,
    bindings: [],
    events: [],
    accessibility: {
      role: 'list',
    },
    documentation: {
      summary: 'Shows progress across multi-step workflows.',
    },
  },
];

export function getDefaultComponentCatalog(): ComponentCatalogEntry[] {
  return defaultCatalog.map(cloneContract);
}

export function findComponentContract(type: string): ComponentCatalogEntry | undefined {
  return defaultCatalog.find((component) => component.type === type);
}

function cloneContract(contract: ComponentCatalogEntry): ComponentCatalogEntry {
  if (typeof structuredClone === 'function') {
    return structuredClone(contract);
  }
  return JSON.parse(JSON.stringify(contract)) as ComponentCatalogEntry;
}

export { defaultCatalog };
