import type { CountryCode } from './country-codes';

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];

export interface ExecutionContext {
  tenantId: string;
  userId: string;
  role: string;
  roles: string[];
  orgId?: string;
  programId?: string;
  issuerId?: string;
  country: CountryCode;
  locale: string;
  timezone: string;
  device: 'mobile' | 'tablet' | 'desktop';
  permissions: string[];
  featureFlags: Record<string, boolean>;
}

export interface UISchema {
  version: string;
  pageId: string;
  layout: LayoutNode;
  components: UIComponent[];
  sections?: SectionNode[];
  layoutType?: 'grid';
  grid?: UIGridSpec;
  items?: UIGridItem[];
}

export type LayoutTreeNode = SectionNode | RowNode | ColumnNode | LayoutComponentNode;

export type LayoutContainerNode = SectionNode | RowNode | ColumnNode;

export interface BaseLayoutTreeNode {
  id: string;
  kind: 'section' | 'row' | 'column' | 'component';
  label?: string;
  className?: string;
  props?: Record<string, JSONValue>;
  hiddenWhen?: RuleCondition;
}

export interface SectionNode extends BaseLayoutTreeNode {
  kind: 'section';
  title?: string;
  rows: RowNode[];
}

export interface RowNode extends BaseLayoutTreeNode {
  kind: 'row';
  columns: ColumnNode[];
}

export interface ColumnNode extends BaseLayoutTreeNode {
  kind: 'column';
  span?: number;
  children: LayoutColumnChildNode[];
}

export interface LayoutComponentNode extends BaseLayoutTreeNode {
  kind: 'component';
  componentId: string;
  componentType?: string;
  componentSpan?: number;
}

export type LayoutColumnChildNode = SectionNode | LayoutComponentNode;

export interface UISchemaPage {
  pageId: string;
  sections: SectionNode[];
}

export type LayoutNode = GridLayout | StackLayout | TabsLayout | SectionLayout;

export interface BaseLayoutNode {
  id: string;
  type: 'grid' | 'stack' | 'tabs' | 'section';
  props?: Record<string, JSONValue>;
  componentIds?: string[];
  children?: LayoutNode[];
}

export interface GridLayout extends BaseLayoutNode {
  type: 'grid';
  columns?: number;
  rows?: number;
}

export type LayoutBreakpoint = 'lg' | 'md' | 'sm';

export interface UIGridSpec {
  columns: number;
  rowHeight: number;
  gap: number;
  collisionStrategy?: 'push' | 'swap';
  breakpoints?: Partial<Record<LayoutBreakpoint, UIGridBreakpoint>>;
}

export interface UIGridBreakpoint {
  columns: number;
  rowHeight?: number;
  gap?: number;
}

export interface UIGridItem {
  id: string;
  componentId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layer?: number;
  breakpoint?: LayoutBreakpoint;
  props?: Record<string, JSONValue>;
  bindings?: BindingSpec;
  rules?: UIComponentRules;
}

export interface StackLayout extends BaseLayoutNode {
  type: 'stack';
  direction?: 'vertical' | 'horizontal';
}

export interface TabsLayout extends BaseLayoutNode {
  type: 'tabs';
  tabs: Array<{ id: string; label: string; child: LayoutNode }>;
}

export interface SectionLayout extends BaseLayoutNode {
  type: 'section';
  title?: string;
}

export interface UIComponent {
  id: string;
  type: string;
  adapterHint: string;
  props?: Record<string, JSONValue>;
  bindings?: BindingSpec;
  validations?: ValidationSpec;
  i18n?: I18nSpec;
  accessibility: AccessibilitySpec;
  responsive?: ResponsiveSpec;
  events?: EventHandlers;
  rules?: UIComponentRules;
}

export interface BindingSpec {
  data?: Record<string, string>;
  context?: Record<string, string>;
  computed?: Record<string, string>;
}

export interface ValidationSpec {
  required?: boolean;
  min?: number;
  max?: number;
  regex?: string;
  minDate?: string;
  maxDate?: string;
  minTime?: string;
  maxTime?: string;
  rules?: string[];
}

export interface AccessibilitySpec {
  ariaLabelKey: string;
  tabIndex?: number;
  role?: string;
  keyboardNav?: boolean;
  focusOrder?: number;
}

export interface I18nSpec {
  labelKey?: string;
  helperTextKey?: string;
  placeholderKey?: string;
}

export interface ResponsiveSpec {
  breakpoints?: Record<
    string,
    {
      columns?: number;
      span?: number;
      hidden?: boolean;
    }
  >;
}

export interface EventHandlers {
  onChange?: UIEventAction[];
  onClick?: UIEventAction[];
  onSubmit?: UIEventAction[];
}

export interface UIComponentRules {
  visibleWhen?: RuleCondition;
  disabledWhen?: RuleCondition;
  requiredWhen?: RuleCondition;
  setValueWhen?: UISetValueWhenRule;
}

export interface UISetValueWhenRule {
  when: RuleCondition;
  value: JSONValue;
  path?: string;
}

export interface UIEventAction {
  type: string;
  payload?: Record<string, JSONValue>;
}

export interface FlowSchema {
  version: string;
  flowId: string;
  initialState: string;
  states: Record<string, FlowState>;
}

export interface FlowState {
  uiPageId: string;
  on: Record<string, FlowTransition>;
}

export interface FlowTransition {
  target: string;
  guard?: RuleCondition;
  condition?: string | RuleCondition;
  actions?: FlowAction[];
  apiId?: string;
}

export type FlowAction = 'evaluateRules' | 'callApi' | 'setContext' | 'navigate';

export interface RuleSet {
  version: string;
  rules: Rule[];
}

export interface Rule {
  ruleId: string;
  description?: string;
  priority?: number;
  salience?: number;
  version?: string;
  scope?: RuleScope;
  when: RuleCondition;
  actions?: RuleAction[];
}

export interface RuleScope {
  countries?: CountryCode[];
  roles?: string[];
  tenants?: string[];
  orgs?: string[];
  programs?: string[];
  issuers?: string[];
}

export type RuleCondition = AllCondition | AnyCondition | NotCondition | CompareCondition;

export interface AllCondition {
  all: RuleCondition[];
}

export interface AnyCondition {
  any: RuleCondition[];
}

export interface NotCondition {
  not: RuleCondition;
}

export interface CompareCondition {
  op: RuleOperator;
  left: RuleOperand;
  right?: RuleOperand;
}

export type RuleOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'dateEq'
  | 'dateBefore'
  | 'dateAfter'
  | 'dateBetween'
  | 'in'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'exists';

export type RuleOperand = { path: string } | { value: JSONValue };

export type RuleAction =
  | { type: 'setField'; path: string; value: JSONValue }
  | { type: 'setContext'; path: string; value: JSONValue }
  | { type: 'removeField'; path: string }
  | { type: 'addItem'; path: string; value: JSONValue }
  | { type: 'mapField'; from: string; to: string }
  | { type: 'throwError'; message: string; code?: string }
  | { type: 'emitEvent'; event: string; payload?: JSONValue };

export interface ApiMapping {
  version: string;
  apiId: string;
  type: 'rest' | 'graphql';
  method: HttpMethod;
  endpoint: string;
  requestMap: RequestMap;
  responseMap: ResponseMap;
  transforms?: TransformSpec[];
  conditions?: RuleCondition;
  errorHandling?: ErrorHandling;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface MappingSource {
  from: string;
  transform?: string;
  default?: JSONValue;
}

export interface RequestMap {
  body?: Record<string, MappingSource>;
  query?: Record<string, MappingSource>;
  headers?: Record<string, MappingSource>;
}

export interface ResponseMap {
  data?: Record<string, string>;
  context?: Record<string, string>;
}

export interface TransformSpec {
  name: string;
  expression: string;
}

export interface ErrorHandling {
  map?: Record<string, string>;
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };
}
