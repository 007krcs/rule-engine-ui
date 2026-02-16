export type CatalogCategory =
  | 'inputs'
  | 'data-display'
  | 'feedback'
  | 'surfaces'
  | 'navigation'
  | 'layout'
  | 'utils';

export interface PropDoc {
  name: string;
  type: string;
  defaultValue?: string;
  description: string;
}

export interface ComponentDoc {
  slug: string;
  name: string;
  category: CatalogCategory;
  summary: string;
  props: PropDoc[];
  tokens: string[];
  accessibility: string[];
  exampleSnippet: string;
}

export const categoryLabels: Record<CatalogCategory, string> = {
  inputs: 'Inputs',
  'data-display': 'Data Display',
  feedback: 'Feedback',
  surfaces: 'Surfaces',
  navigation: 'Navigation',
  layout: 'Layout',
  utils: 'Utils',
};

export const categoryOrder: CatalogCategory[] = [
  'inputs',
  'data-display',
  'feedback',
  'surfaces',
  'navigation',
  'layout',
  'utils',
];

const commonFocusA11y = [
  'Supports keyboard tab navigation with visible focus ring.',
  'Uses semantic HTML roles/attributes where applicable.',
];

export const componentCatalog: ComponentDoc[] = [
  {
    slug: 'button',
    name: 'PFButton',
    category: 'inputs',
    summary: 'Primary action control with variant, size, icon slots, and loading state.',
    props: [
      { name: 'variant', type: '"contained" | "outline" | "ghost"', defaultValue: '"contained"', description: 'Visual treatment.' },
      { name: 'size', type: '"sm" | "md" | "lg"', defaultValue: '"md"', description: 'Control height and font sizing.' },
      { name: 'loading', type: 'boolean', defaultValue: 'false', description: 'Shows spinner and disables action.' },
    ],
    tokens: ['--pf-color-primary-500', '--pf-radius-md', '--pf-control-height-md'],
    accessibility: [...commonFocusA11y, 'Use descriptive button labels for screen readers.'],
    exampleSnippet: '<PFButton variant="contained" size="md">Save</PFButton>',
  },
  {
    slug: 'icon-button',
    name: 'PFIconButton',
    category: 'inputs',
    summary: 'Icon-only button with required accessible label.',
    props: [
      { name: 'label', type: 'string', description: 'Accessible aria-label text.' },
      { name: 'variant', type: '"contained" | "outline" | "ghost"', defaultValue: '"ghost"', description: 'Visual style.' },
      { name: 'loading', type: 'boolean', defaultValue: 'false', description: 'Busy state spinner.' },
    ],
    tokens: ['--pf-control-height-md', '--pf-radius-md'],
    accessibility: [...commonFocusA11y, 'Always provide a meaningful `label` prop.'],
    exampleSnippet: '<PFIconButton label="Edit"><EditIcon /></PFIconButton>',
  },
  {
    slug: 'button-group',
    name: 'PFButtonGroup',
    category: 'inputs',
    summary: 'Grouped button actions with shared border and orientation support.',
    props: [
      { name: 'vertical', type: 'boolean', defaultValue: 'false', description: 'Stack group vertically.' },
      { name: 'ariaLabel', type: 'string', description: 'Group label for assistive tech.' },
    ],
    tokens: ['--pf-surface-border', '--pf-radius-md'],
    accessibility: [...commonFocusA11y, 'Set `ariaLabel` to describe grouped actions.'],
    exampleSnippet: '<PFButtonGroup><PFButton>One</PFButton><PFButton>Two</PFButton></PFButtonGroup>',
  },
  {
    slug: 'toggle-button-group',
    name: 'PFToggleButtonGroup',
    category: 'inputs',
    summary: 'Selectable segmented controls supporting exclusive or multi select.',
    props: [
      { name: 'options', type: 'PFToggleOption[]', description: 'Toggle options list.' },
      { name: 'exclusive', type: 'boolean', defaultValue: 'true', description: 'Single selection mode.' },
      { name: 'value', type: 'string | string[]', description: 'Current selected values.' },
    ],
    tokens: ['--pf-color-primary-500', '--pf-surface-border'],
    accessibility: [...commonFocusA11y, 'Uses `aria-pressed` per toggle button.'],
    exampleSnippet: '<PFToggleButtonGroup options={...} value="day" />',
  },
  {
    slug: 'input',
    name: 'PFInput',
    category: 'inputs',
    summary: 'Single-line text input with variants and loading affordance.',
    props: [
      { name: 'variant', type: '"outline" | "filled" | "ghost"', defaultValue: '"outline"', description: 'Input style variant.' },
      { name: 'size', type: '"sm" | "md" | "lg"', defaultValue: '"md"', description: 'Input control size.' },
      { name: 'loading', type: 'boolean', defaultValue: 'false', description: 'Shows trailing spinner and disables field.' },
    ],
    tokens: ['--pf-surface-border', '--pf-control-height-md'],
    accessibility: [...commonFocusA11y, 'Associate with `label` for accessible forms.'],
    exampleSnippet: '<PFInput placeholder="Search accounts" />',
  },
  {
    slug: 'text-field',
    name: 'PFTextField',
    category: 'inputs',
    summary: 'Composed field primitive with label, helper text, and error semantics.',
    props: [
      { name: 'label', type: 'ReactNode', description: 'Field label.' },
      { name: 'helperText', type: 'ReactNode', description: 'Additional guidance text.' },
      { name: 'error', type: 'boolean', defaultValue: 'false', description: 'Sets invalid state and helper style.' },
    ],
    tokens: ['--pf-font-size-xs', '--pf-color-error-600'],
    accessibility: [...commonFocusA11y, 'Links helper text through `aria-describedby`.'],
    exampleSnippet: '<PFTextField id="email" label="Email" helperText="Required" />',
  },
  {
    slug: 'select',
    name: 'PFSelect',
    category: 'inputs',
    summary: 'Native-select wrapper with tokenized styling and placeholder support.',
    props: [
      { name: 'options', type: 'PFSelectOption[]', description: 'Selectable option list.' },
      { name: 'placeholder', type: 'string', description: 'Leading placeholder option.' },
      { name: 'loading', type: 'boolean', defaultValue: 'false', description: 'Disables field and shows spinner.' },
    ],
    tokens: ['--pf-surface-border', '--pf-control-height-md'],
    accessibility: [...commonFocusA11y, 'Use label association for context.'],
    exampleSnippet: '<PFSelect options={[{ value: "us", label: "United States" }]} />',
  },
  {
    slug: 'checkbox',
    name: 'PFCheckbox',
    category: 'inputs',
    summary: 'Checkbox control with optional helper text.',
    props: [
      { name: 'label', type: 'ReactNode', description: 'Main choice label.' },
      { name: 'helperText', type: 'ReactNode', description: 'Secondary explanatory text.' },
      { name: 'checked', type: 'boolean', description: 'Controlled checked state.' },
    ],
    tokens: ['--pf-color-primary-500'],
    accessibility: [...commonFocusA11y, 'Native checkbox semantics preserve assistive behavior.'],
    exampleSnippet: '<PFCheckbox label="I agree to the policy" />',
  },
  {
    slug: 'radio',
    name: 'PFRadio',
    category: 'inputs',
    summary: 'Radio selection control for mutually exclusive options.',
    props: [
      { name: 'name', type: 'string', description: 'Group name for mutual exclusivity.' },
      { name: 'label', type: 'ReactNode', description: 'Radio label.' },
      { name: 'checked', type: 'boolean', description: 'Controlled state.' },
    ],
    tokens: ['--pf-color-primary-500'],
    accessibility: [...commonFocusA11y, 'Use shared `name` attribute for groups.'],
    exampleSnippet: '<PFRadio name="tier" label="Enterprise" />',
  },
  {
    slug: 'switch',
    name: 'PFSwitch',
    category: 'inputs',
    summary: 'Binary switch component using `role="switch"` semantics.',
    props: [
      { name: 'checked', type: 'boolean', description: 'Current state.' },
      { name: 'label', type: 'ReactNode', description: 'Visible switch label.' },
      { name: 'onCheckedChange', type: '(checked: boolean) => void', description: 'State callback.' },
    ],
    tokens: ['--pf-color-primary-500', '--pf-radius-full'],
    accessibility: [...commonFocusA11y, '`role="switch"` and checked state are exposed to AT.'],
    exampleSnippet: '<PFSwitch checked label="Enable approvals" />',
  },
  {
    slug: 'slider',
    name: 'PFSlider',
    category: 'inputs',
    summary: 'Range slider with optional value output.',
    props: [
      { name: 'min', type: 'number', defaultValue: '0', description: 'Minimum value.' },
      { name: 'max', type: 'number', defaultValue: '100', description: 'Maximum value.' },
      { name: 'showValue', type: 'boolean', defaultValue: 'true', description: 'Show current output value.' },
    ],
    tokens: ['--pf-color-primary-500'],
    accessibility: [...commonFocusA11y, 'Native range input keyboard support is preserved.'],
    exampleSnippet: '<PFSlider min={0} max={100} value={65} />',
  },
  {
    slug: 'autocomplete',
    name: 'PFAutocomplete',
    category: 'inputs',
    summary: 'Basic autocomplete built on native datalist for portability.',
    props: [
      { name: 'options', type: 'PFAutocompleteOption[]', description: 'Suggested values list.' },
      { name: 'loading', type: 'boolean', defaultValue: 'false', description: 'Busy state visual.' },
      { name: 'variant', type: '"outline" | "filled" | "ghost"', defaultValue: '"outline"', description: 'Field appearance.' },
    ],
    tokens: ['--pf-control-height-md', '--pf-surface-border'],
    accessibility: [...commonFocusA11y, 'Exposes combobox role and list autocomplete hints.'],
    exampleSnippet: '<PFAutocomplete options={[{ value: "United States" }]} />',
  },
  {
    slug: 'form-label',
    name: 'PFFormLabel',
    category: 'inputs',
    summary: 'Tokenized field label primitive.',
    props: [
      { name: 'htmlFor', type: 'string', description: 'Associated control id.' },
      { name: 'children', type: 'ReactNode', description: 'Label content.' },
    ],
    tokens: ['--pf-font-size-xs', '--pf-surface-text-muted'],
    accessibility: [...commonFocusA11y, 'Connect label and control via `htmlFor`.'],
    exampleSnippet: '<PFFormLabel htmlFor="name">Name</PFFormLabel>',
  },
  {
    slug: 'form-helper-text',
    name: 'PFFormHelperText',
    category: 'inputs',
    summary: 'Context and validation helper text for form fields.',
    props: [
      { name: 'error', type: 'boolean', defaultValue: 'false', description: 'Error tone styling.' },
      { name: 'children', type: 'ReactNode', description: 'Helper content.' },
    ],
    tokens: ['--pf-color-error-600', '--pf-font-size-sm'],
    accessibility: [...commonFocusA11y, 'Reference via `aria-describedby` from related controls.'],
    exampleSnippet: '<PFFormHelperText error>Invalid email format</PFFormHelperText>',
  },
  {
    slug: 'avatar',
    name: 'PFAvatar',
    category: 'data-display',
    summary: 'Image or initials avatar with configurable size.',
    props: [
      { name: 'src', type: 'string', description: 'Image source URL.' },
      { name: 'name', type: 'string', description: 'Name used for initials fallback.' },
      { name: 'sizePx', type: 'number', defaultValue: '36', description: 'Rendered avatar size.' },
    ],
    tokens: ['--pf-radius-full', '--pf-color-primary-200'],
    accessibility: [...commonFocusA11y, 'Provide `alt` for meaningful profile imagery.'],
    exampleSnippet: '<PFAvatar name="Avery Cruz" />',
  },
  {
    slug: 'badge',
    name: 'PFBadge',
    category: 'data-display',
    summary: 'Small count or status marker anchored to content.',
    props: [
      { name: 'badgeContent', type: 'ReactNode', description: 'Count or status text.' },
      { name: 'intent', type: '"neutral" | "primary" | "success" | "warn" | "error"', defaultValue: '"primary"', description: 'Color intent.' },
      { name: 'max', type: 'number', defaultValue: '99', description: 'Cap for numeric display.' },
    ],
    tokens: ['--pf-radius-full', '--pf-color-primary-500'],
    accessibility: [...commonFocusA11y, 'Ensure badge meaning is also available in text context.'],
    exampleSnippet: '<PFBadge badgeContent={12}><PFButton>Inbox</PFButton></PFBadge>',
  },
  {
    slug: 'chip',
    name: 'PFChip',
    category: 'data-display',
    summary: 'Compact label token supporting delete interactions.',
    props: [
      { name: 'variant', type: '"filled" | "outline"', defaultValue: '"filled"', description: 'Chip style.' },
      { name: 'intent', type: '"neutral" | "primary" | "secondary" | "success" | "warn" | "error"', defaultValue: '"neutral"', description: 'Tone intent.' },
      { name: 'onDelete', type: '() => void', description: 'Optional remove action.' },
    ],
    tokens: ['--pf-radius-full', '--pf-color-neutral-100'],
    accessibility: [...commonFocusA11y, 'Delete button includes explicit aria-label.'],
    exampleSnippet: '<PFChip intent="primary">Policy: AML</PFChip>',
  },
  {
    slug: 'table',
    name: 'PFTable',
    category: 'data-display',
    summary: 'Basic responsive table component with column definitions.',
    props: [
      { name: 'columns', type: 'PFTableColumn<T>[]', description: 'Column metadata and cell renderers.' },
      { name: 'rows', type: 'T[]', description: 'Row data array.' },
      { name: 'emptyState', type: 'ReactNode', defaultValue: '"No rows available."', description: 'Empty table text.' },
    ],
    tokens: ['--pf-surface-border', '--pf-surface-layer-alt'],
    accessibility: [...commonFocusA11y, 'Uses semantic `<table>` markup for AT compatibility.'],
    exampleSnippet: '<PFTable columns={[...]} rows={[...]} />',
  },
  {
    slug: 'divider',
    name: 'PFDivider',
    category: 'data-display',
    summary: 'Horizontal or vertical separators for dense layouts.',
    props: [
      { name: 'orientation', type: '"horizontal" | "vertical"', defaultValue: '"horizontal"', description: 'Divider direction.' },
    ],
    tokens: ['--pf-surface-border'],
    accessibility: [...commonFocusA11y, 'Decorative by default; avoid conveying critical meaning only with divider.'],
    exampleSnippet: '<PFDivider orientation="horizontal" />',
  },
  {
    slug: 'typography',
    name: 'PFTypography',
    category: 'data-display',
    summary: 'Typed text primitive mapping semantic tags to visual variants.',
    props: [
      { name: 'variant', type: 'PFTypographyVariant', defaultValue: '"body-md"', description: 'Text style token.' },
      { name: 'as', type: 'HTMLElement tag', description: 'Override rendered element.' },
      { name: 'muted', type: 'boolean', defaultValue: 'false', description: 'Muted color styling.' },
    ],
    tokens: ['--pf-font-size-md', '--pf-font-weight-semibold', '--pf-surface-text-muted'],
    accessibility: [...commonFocusA11y, 'Prefer semantic heading levels with matching content hierarchy.'],
    exampleSnippet: '<PFTypography variant="h2">Billing Settings</PFTypography>',
  },
  {
    slug: 'alert',
    name: 'PFAlert',
    category: 'feedback',
    summary: 'Inline feedback messaging with status intents and optional action.',
    props: [
      { name: 'intent', type: '"neutral" | "primary" | "success" | "warn" | "error"', defaultValue: '"neutral"', description: 'Alert tone.' },
      { name: 'title', type: 'ReactNode', description: 'Optional title heading.' },
      { name: 'action', type: 'ReactNode', description: 'Inline action region.' },
    ],
    tokens: ['--pf-color-warn-100', '--pf-radius-md'],
    accessibility: [...commonFocusA11y, 'Rendered with `role="alert"` for immediate announcement.'],
    exampleSnippet: '<PFAlert intent="warn" title="Validation">Check required fields.</PFAlert>',
  },
  {
    slug: 'snackbar',
    name: 'PFSnackbar',
    category: 'feedback',
    summary: 'Transient notification with optional auto-hide and action.',
    props: [
      { name: 'open', type: 'boolean', description: 'Visibility state.' },
      { name: 'autoHideDuration', type: 'number', defaultValue: '4000', description: 'Auto close timeout in ms.' },
      { name: 'onClose', type: '() => void', description: 'Close callback.' },
    ],
    tokens: ['--pf-shadow-lg', '--pf-z-tooltip'],
    accessibility: [...commonFocusA11y, 'Uses status role for non-blocking announcements.'],
    exampleSnippet: '<PFSnackbar open message="Saved" />',
  },
  {
    slug: 'progress',
    name: 'PFProgress',
    category: 'feedback',
    summary: 'Linear and circular progress indicators for determinate or indeterminate state.',
    props: [
      { name: 'variant', type: '"linear" | "circular"', defaultValue: '"linear"', description: 'Indicator form.' },
      { name: 'value', type: 'number', defaultValue: '0', description: 'Completion percent for determinate state.' },
      { name: 'indeterminate', type: 'boolean', defaultValue: 'false', description: 'Animated ongoing status.' },
    ],
    tokens: ['--pf-color-primary-500', '--pf-radius-full'],
    accessibility: [...commonFocusA11y, 'Progressbar exposes `aria-valuenow` when determinate.'],
    exampleSnippet: '<PFProgress variant="linear" value={64} />',
  },
  {
    slug: 'skeleton',
    name: 'PFSkeleton',
    category: 'feedback',
    summary: 'Loading placeholder blocks for text and media regions.',
    props: [
      { name: 'variant', type: '"text" | "rectangular" | "rounded" | "circular"', defaultValue: '"rectangular"', description: 'Placeholder shape.' },
      { name: 'animated', type: 'boolean', defaultValue: 'true', description: 'Pulse animation toggle.' },
      { name: 'width / height', type: 'number | string', description: 'Custom dimensions.' },
    ],
    tokens: ['--pf-color-neutral-100', '--pf-radius-md'],
    accessibility: [...commonFocusA11y, 'Use skeletons alongside semantic loading states.'],
    exampleSnippet: '<PFSkeleton variant="rounded" height={120} />',
  },
  {
    slug: 'tooltip',
    name: 'PFTooltip',
    category: 'feedback',
    summary: 'Hover/focus contextual hint with multiple placements.',
    props: [
      { name: 'content', type: 'ReactNode', description: 'Tooltip body.' },
      { name: 'placement', type: '"top" | "bottom" | "left" | "right"', defaultValue: '"top"', description: 'Tooltip placement.' },
    ],
    tokens: ['--pf-color-neutral-900', '--pf-z-tooltip'],
    accessibility: [...commonFocusA11y, 'Associates trigger and tooltip via `aria-describedby`.'],
    exampleSnippet: '<PFTooltip content="Copy link"><PFIconButton ... /></PFTooltip>',
  },
  {
    slug: 'backdrop',
    name: 'PFBackdrop',
    category: 'feedback',
    summary: 'Screen overlay used for modal states and blocking interactions.',
    props: [
      { name: 'open', type: 'boolean', description: 'Visibility toggle.' },
      { name: 'onClick', type: '() => void', description: 'Backdrop click callback.' },
    ],
    tokens: ['--pf-surface-overlay', '--pf-z-modal'],
    accessibility: [...commonFocusA11y, 'Pair with trapped focus content for modals/drawers.'],
    exampleSnippet: '<PFBackdrop open onClick={close} />',
  },
  {
    slug: 'card',
    name: 'PFCard',
    category: 'surfaces',
    summary: 'Content surface with optional elevation and slot subcomponents.',
    props: [
      { name: 'elevated', type: 'boolean', defaultValue: 'false', description: 'Applies elevation shadow.' },
      { name: 'children', type: 'ReactNode', description: 'Compose with header/content/actions slots.' },
    ],
    tokens: ['--pf-surface-layer', '--pf-shadow-md', '--pf-radius-lg'],
    accessibility: [...commonFocusA11y, 'Use heading semantics inside card content for structure.'],
    exampleSnippet: '<PFCard elevated><PFCardHeader>...</PFCardHeader></PFCard>',
  },
  {
    slug: 'dialog',
    name: 'PFDialog',
    category: 'surfaces',
    summary: 'Modal dialog with structured Header, Body, and Actions slots.',
    props: [
      { name: 'open', type: 'boolean', description: 'Open state.' },
      { name: 'onClose', type: '() => void', description: 'Escape/backdrop close callback.' },
      { name: 'actions', type: 'ReactNode', description: 'Footer action slot.' },
    ],
    tokens: ['--pf-z-modal', '--pf-shadow-xl', '--pf-surface-overlay'],
    accessibility: [...commonFocusA11y, 'Uses `role="dialog"` and `aria-modal="true"`.'],
    exampleSnippet: '<PFDialog open title="Review" actions={<PFButton>Close</PFButton>} />',
  },
  {
    slug: 'app-bar',
    name: 'PFAppBar',
    category: 'surfaces',
    summary: 'Top chrome surface for global context and actions.',
    props: [
      { name: 'position', type: '"static" | "sticky"', defaultValue: '"sticky"', description: 'Placement mode.' },
      { name: 'children', type: 'ReactNode', description: 'Toolbar/content slot.' },
    ],
    tokens: ['--pf-z-sticky', '--pf-surface-border'],
    accessibility: [...commonFocusA11y, 'Use landmark semantics through header placement.'],
    exampleSnippet: '<PFAppBar><PFToolbar>...</PFToolbar></PFAppBar>',
  },
  {
    slug: 'drawer',
    name: 'PFDrawer',
    category: 'surfaces',
    summary: 'Side panel surface with backdrop and escape handling.',
    props: [
      { name: 'open', type: 'boolean', description: 'Drawer visibility.' },
      { name: 'side', type: '"left" | "right"', defaultValue: '"left"', description: 'Drawer side.' },
      { name: 'onClose', type: '() => void', description: 'Close callback.' },
    ],
    tokens: ['--pf-z-drawer', '--pf-surface-overlay', '--pf-shadow-lg'],
    accessibility: [...commonFocusA11y, 'Implements dialog semantics with escape-to-close.'],
    exampleSnippet: '<PFDrawer open title="Filters">...</PFDrawer>',
  },
  {
    slug: 'tabs',
    name: 'PFTabs',
    category: 'navigation',
    summary: 'Tab navigation with arrow-key switching and panel rendering.',
    props: [
      { name: 'tabs', type: 'PFTabItem[]', description: 'Tab metadata and panel content.' },
      { name: 'value', type: 'string', description: 'Active tab id.' },
      { name: 'onChange', type: '(value: string) => void', description: 'Tab switch callback.' },
    ],
    tokens: ['--pf-color-primary-600', '--pf-surface-border'],
    accessibility: [...commonFocusA11y, 'Implements tablist/tab/tabpanel roles and arrow nav.'],
    exampleSnippet: '<PFTabs tabs={[...]} value="overview" onChange={setTab} />',
  },
  {
    slug: 'breadcrumbs',
    name: 'PFBreadcrumbs',
    category: 'navigation',
    summary: 'Hierarchical path navigation with optional links/actions.',
    props: [
      { name: 'items', type: 'PFBreadcrumbItem[]', description: 'Path segments.' },
      { name: 'separator', type: 'ReactNode', defaultValue: '"/"', description: 'Visual separator.' },
    ],
    tokens: ['--pf-surface-text-muted'],
    accessibility: [...commonFocusA11y, 'Uses `<nav aria-label="Breadcrumb">` semantics.'],
    exampleSnippet: '<PFBreadcrumbs items={[...]} />',
  },
  {
    slug: 'menu',
    name: 'PFMenu',
    category: 'navigation',
    summary: 'Popup action menu with internal or controlled open state.',
    props: [
      { name: 'triggerLabel', type: 'ReactNode', description: 'Menu trigger content.' },
      { name: 'items', type: 'PFMenuItem[]', description: 'Menu options.' },
      { name: 'onSelect', type: '(id: string) => void', description: 'Item selection callback.' },
    ],
    tokens: ['--pf-z-dropdown', '--pf-shadow-md'],
    accessibility: [...commonFocusA11y, 'Uses menu/menuitem roles and keyboard activation.'],
    exampleSnippet: '<PFMenu triggerLabel="Actions" items={[...]} />',
  },
  {
    slug: 'pagination',
    name: 'PFPagination',
    category: 'navigation',
    summary: 'Page navigation control with sibling windowing.',
    props: [
      { name: 'count', type: 'number', description: 'Total pages.' },
      { name: 'page', type: 'number', description: 'Active page.' },
      { name: 'onPageChange', type: '(page: number) => void', description: 'Page change callback.' },
    ],
    tokens: ['--pf-color-primary-500', '--pf-surface-border'],
    accessibility: [...commonFocusA11y, 'Exposes current page via `aria-current="page"`.'],
    exampleSnippet: '<PFPagination count={20} page={3} onPageChange={setPage} />',
  },
  {
    slug: 'stepper',
    name: 'PFStepper',
    category: 'navigation',
    summary: 'Progressive step indicator for guided workflows.',
    props: [
      { name: 'steps', type: 'PFStep[]', description: 'Ordered steps.' },
      { name: 'activeStep', type: 'number', description: 'Current active index.' },
    ],
    tokens: ['--pf-color-primary-500', '--pf-color-success-500', '--pf-radius-full'],
    accessibility: [...commonFocusA11y, 'Expose step labels and status text in copy for AT.'],
    exampleSnippet: '<PFStepper steps={[...]} activeStep={1} />',
  },
  {
    slug: 'app-shell',
    name: 'PFAppShell',
    category: 'layout',
    summary: 'Top-level application frame with app bar, sidebar, and content regions.',
    props: [
      { name: 'appBar', type: 'ReactNode', description: 'Top app bar slot.' },
      { name: 'sidebar', type: 'ReactNode', description: 'Navigation/sidebar slot.' },
      { name: 'drawer', type: 'ReactNode', description: 'Optional overlay drawer slot.' },
    ],
    tokens: ['--pf-surface-layer', '--pf-surface-border'],
    accessibility: [...commonFocusA11y, 'Preserves landmark semantics using main/aside regions.'],
    exampleSnippet: '<PFAppShell appBar={<PFAppBar />} sidebar={<nav />} />',
  },
  {
    slug: 'toolbar',
    name: 'PFToolbar',
    category: 'layout',
    summary: 'Horizontal action row typically nested in app bars.',
    props: [
      { name: 'children', type: 'ReactNode', description: 'Toolbar content.' },
    ],
    tokens: ['--pf-space-3'],
    accessibility: [...commonFocusA11y, 'Ensure toolbar controls have individual labels.'],
    exampleSnippet: '<PFToolbar><PFButton>Save</PFButton></PFToolbar>',
  },
  {
    slug: 'container',
    name: 'PFContainer',
    category: 'layout',
    summary: 'Responsive page container with max-width presets.',
    props: [
      { name: 'maxWidth', type: '"sm" | "md" | "lg" | "xl" | "2xl" | string | number', defaultValue: '"lg"', description: 'Container width.' },
      { name: 'fluid', type: 'boolean', defaultValue: 'false', description: 'Disable max width constraint.' },
    ],
    tokens: ['--pf-space-4', '--pf-space-8'],
    accessibility: [...commonFocusA11y, 'Layout primitive; semantic responsibility stays with children.'],
    exampleSnippet: '<PFContainer maxWidth="xl">...</PFContainer>',
  },
  {
    slug: 'grid',
    name: 'PFGrid',
    category: 'layout',
    summary: 'CSS-grid layout primitive with tokenized gaps and columns.',
    props: [
      { name: 'columns', type: 'number', defaultValue: '12', description: 'Grid column count.' },
      { name: 'gap', type: 'number | string', defaultValue: 'var(--pf-space-4)', description: 'Grid gap.' },
      { name: 'minItemWidth', type: 'string', description: 'Minimum item width for adaptive tracks.' },
    ],
    tokens: ['--pf-space-4'],
    accessibility: [...commonFocusA11y, 'Use semantic child elements when conveying structure.'],
    exampleSnippet: '<PFGrid columns={3} gap="var(--pf-space-4)">...</PFGrid>',
  },
  {
    slug: 'stack',
    name: 'PFStack',
    category: 'layout',
    summary: 'One-dimensional flex layout primitive with direction and spacing control.',
    props: [
      { name: 'direction', type: '"row" | "column"', defaultValue: '"column"', description: 'Axis direction.' },
      { name: 'gap', type: 'number | string', defaultValue: 'var(--pf-space-3)', description: 'Item spacing.' },
      { name: 'align / justify', type: 'CSS values', description: 'Alignment controls.' },
    ],
    tokens: ['--pf-space-3'],
    accessibility: [...commonFocusA11y, 'Maintain reading order in DOM independent of visual direction.'],
    exampleSnippet: '<PFStack direction="row" gap="var(--pf-space-2)">...</PFStack>',
  },
  {
    slug: 'box',
    name: 'PFBox',
    category: 'layout',
    summary: 'Generic wrapper primitive supporting `as` polymorphism.',
    props: [
      { name: 'as', type: 'ElementType', description: 'Rendered HTML element/component.' },
      { name: 'children', type: 'ReactNode', description: 'Content region.' },
    ],
    tokens: ['--pf-surface-text'],
    accessibility: [...commonFocusA11y, 'Choose semantic `as` element for meaning.'],
    exampleSnippet: '<PFBox as="section">...</PFBox>',
  },
  {
    slug: 'theme-provider',
    name: 'PlatformThemeProvider',
    category: 'utils',
    summary: 'Runtime theme manager with dark mode, density, and tenant theme loading.',
    props: [
      { name: 'theme', type: 'PlatformTheme', description: 'Base theme contract instance.' },
      { name: 'tenantThemeLoader', type: '() => Promise<DeepPartial<PlatformTheme>>', description: 'Async tenant override loader.' },
      { name: 'target', type: 'HTMLElement', description: 'Optional theme variable target element.' },
    ],
    tokens: ['data-theme', 'data-density', '--pf-*'],
    accessibility: [...commonFocusA11y, 'Theme changes preserve contrast and focus indicators.'],
    exampleSnippet: '<PlatformThemeProvider initialMode="dark">...</PlatformThemeProvider>',
  },
];

export function getComponentDoc(slug: string): ComponentDoc | undefined {
  return componentCatalog.find((component) => component.slug === slug);
}

export function getComponentsForCategory(category: CatalogCategory): ComponentDoc[] {
  return componentCatalog.filter((component) => component.category === category);
}
