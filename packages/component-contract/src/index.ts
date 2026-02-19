export type ComponentCategory =
  | 'Form Controls'
  | 'Layout'
  | 'Data Display'
  | 'Feedback'
  | 'Navigation'
  | 'Surfaces'
  | 'Utils'
  | 'Other';

export type ComponentPropValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: ComponentPropValue }
  | ComponentPropValue[];

export type ComponentIcon =
  | { kind: 'glyph'; value: string }
  | { kind: 'url'; value: string }
  | { kind: 'svg'; value: string }
  | string;

export type ComponentPropKind = 'string' | 'number' | 'boolean' | 'enum' | 'json';

export interface ComponentPropOption {
  value: string;
  label: string;
}

export interface ComponentPropBase {
  kind: ComponentPropKind;
  label: string;
  description?: string;
  defaultValue?: ComponentPropValue;
  required?: boolean;
  editable?: boolean;
  group?: string;
}

export interface StringPropDefinition extends ComponentPropBase {
  kind: 'string';
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface NumberPropDefinition extends ComponentPropBase {
  kind: 'number';
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanPropDefinition extends ComponentPropBase {
  kind: 'boolean';
}

export interface EnumPropDefinition extends ComponentPropBase {
  kind: 'enum';
  options: ComponentPropOption[];
}

export interface JsonPropDefinition extends ComponentPropBase {
  kind: 'json';
}

export type ComponentPropDefinition =
  | StringPropDefinition
  | NumberPropDefinition
  | BooleanPropDefinition
  | EnumPropDefinition
  | JsonPropDefinition;

export type ComponentPropDefinitionFor<T> =
  T extends string
    ? StringPropDefinition
    : T extends number
      ? NumberPropDefinition
      : T extends boolean
        ? BooleanPropDefinition
        : ComponentPropDefinition;

export type ComponentPropSchema<
  TProps extends Record<string, ComponentPropValue> = Record<string, ComponentPropValue>,
> = {
  [K in keyof TProps]?: ComponentPropDefinitionFor<TProps[K]>;
};

export type ComponentBindingKind = 'data' | 'context' | 'state' | 'computed';

export interface ComponentBindingDefinition {
  key: string;
  kind: ComponentBindingKind;
  label?: string;
  description?: string;
  required?: boolean;
  defaultPath?: string;
}

export interface ComponentEventDefinition {
  name: string;
  description?: string;
  payloadSchema?: Record<string, ComponentPropDefinition>;
}

export interface ComponentValidationDefinition {
  supports?: string[];
  notes?: string[];
}

export interface ComponentAccessibilityDefinition {
  role?: string;
  requiredProps?: string[];
  recommendedProps?: string[];
  notes?: string[];
}

export interface ComponentDocumentation {
  summary?: string;
  examples?: string[];
  tips?: string[];
}

export interface ComponentContract<
  TProps extends Record<string, ComponentPropValue> = Record<string, ComponentPropValue>,
> {
  type: string;
  displayName: string;
  category: ComponentCategory | string;
  description?: string;
  icon?: ComponentIcon;
  version?: string;
  adapterHint?: string;
  props: ComponentPropSchema<TProps>;
  defaultProps?: Partial<TProps>;
  bindings?: ComponentBindingDefinition[];
  events?: ComponentEventDefinition[];
  accessibility?: ComponentAccessibilityDefinition;
  validation?: ComponentValidationDefinition;
  documentation?: ComponentDocumentation;
  tags?: string[];
}

export class ComponentRegistry<TImplementation = unknown> {
  private contracts = new Map<string, ComponentContract>();
  private implementations = new Map<string, TImplementation>();

  register<TProps extends Record<string, ComponentPropValue>>(
    contract: ComponentContract<TProps>,
    implementation?: TImplementation,
  ): void {
    if (!contract.type) {
      throw new Error('ComponentContract.type is required');
    }
    this.contracts.set(contract.type, contract as ComponentContract);
    if (implementation !== undefined) {
      this.implementations.set(contract.type, implementation);
    }
  }

  getContract(type: string): ComponentContract | undefined {
    return this.contracts.get(type);
  }

  getImplementation(type: string): TImplementation | undefined {
    return this.implementations.get(type);
  }

  listContracts(): ComponentContract[] {
    return Array.from(this.contracts.values());
  }
}

export function createComponentRegistry<TImplementation = unknown>(): ComponentRegistry<TImplementation> {
  return new ComponentRegistry<TImplementation>();
}

export function isComponentContract(value: unknown): value is ComponentContract {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<ComponentContract>;
  return (
    typeof candidate.type === 'string' &&
    candidate.type.length > 0 &&
    typeof candidate.displayName === 'string' &&
    candidate.displayName.length > 0 &&
    typeof candidate.category === 'string' &&
    candidate.category.length > 0 &&
    typeof candidate.props === 'object'
  );
}
