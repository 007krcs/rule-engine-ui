import type { ComponentContract, ComponentPropDefinition } from '@platform/component-contract';
import type {
  ApplicationBundle,
  FlowSchema,
  JSONValue,
  LayoutTreeNode,
  SectionNode,
  UIComponent,
  UISchema,
} from '@platform/schema';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: ValidationSeverity;
  category?: 'schema' | 'accessibility' | 'i18n';
}

export interface ValidationOptions {
  developmentMode?: boolean;
  skipA11yI18nInDev?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function validateApplicationBundle(
  bundle: ApplicationBundle,
  contracts: ComponentContract[],
  options: ValidationOptions = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const contractMap = new Map<string, ComponentContract>(contracts.map((contract) => [contract.type, contract]));

  if (!bundle.metadata.configId) {
    issues.push({
      path: 'metadata.configId',
      message: 'configId is required',
      severity: 'error',
      category: 'schema',
    });
  }

  if (!bundle.metadata.tenantId) {
    issues.push({
      path: 'metadata.tenantId',
      message: 'tenantId is required',
      severity: 'error',
      category: 'schema',
    });
  }

  if (!Number.isFinite(bundle.metadata.version) || bundle.metadata.version < 1) {
    issues.push({
      path: 'metadata.version',
      message: 'version must be a positive number',
      severity: 'error',
      category: 'schema',
    });
  }

  const uiSchemaEntries = Object.entries(bundle.uiSchemas ?? {});
  if (uiSchemaEntries.length === 0) {
    issues.push({
      path: 'uiSchemas',
      message: 'At least one UI screen is required',
      severity: 'error',
      category: 'schema',
    });
  }

  validateFlowSchema(bundle.flowSchema, bundle.uiSchemas, issues);

  const pageIds = new Set<string>();
  const globalComponentIds: string[] = [];
  for (const [screenId, schema] of uiSchemaEntries) {
    validateUiSchema(screenId, schema, contractMap, issues);
    if (schema.pageId) {
      if (pageIds.has(schema.pageId)) {
        issues.push({
          path: `uiSchemas.${screenId}.pageId`,
          message: `pageId "${schema.pageId}" is duplicated`,
          severity: 'warning',
          category: 'schema',
        });
      }
      pageIds.add(schema.pageId);
    }
    globalComponentIds.push(...schema.components.map((component) => component.id));
  }

  const globalDuplicates = findDuplicates(globalComponentIds);
  for (const duplicateId of globalDuplicates) {
    issues.push({
      path: 'uiSchemas',
      message: `Component id "${duplicateId}" is duplicated across screens`,
      severity: 'error',
      category: 'schema',
    });
  }

  validateRuleReferences(bundle.flowSchema, bundle.rules?.rules ?? [], issues);
  validateThemeContrast(bundle, issues);

  const normalizedIssues = normalizeSeverityForDevMode(issues, options);

  return {
    valid: normalizedIssues.every((issue) => issue.severity !== 'error'),
    issues: normalizedIssues,
  };
}

function validateFlowSchema(
  flowSchema: FlowSchema,
  uiSchemas: Record<string, UISchema>,
  issues: ValidationIssue[],
): void {
  const stateIds = Object.keys(flowSchema.states ?? {});
  if (stateIds.length === 0) {
    issues.push({
      path: 'flowSchema.states',
      message: 'Flow schema must define at least one state',
      severity: 'error',
      category: 'schema',
    });
    return;
  }

  if (!stateIds.includes(flowSchema.initialState)) {
    issues.push({
      path: 'flowSchema.initialState',
      message: `Initial state "${flowSchema.initialState}" does not exist`,
      severity: 'error',
      category: 'schema',
    });
  }

  for (const [stateId, state] of Object.entries(flowSchema.states ?? {})) {
    if (!uiSchemas[stateId]) {
      issues.push({
        path: `uiSchemas.${stateId}`,
        message: `No UISchema found for flow state "${stateId}"`,
        severity: 'error',
        category: 'schema',
      });
    } else if (state.uiPageId && uiSchemas[stateId]?.pageId !== state.uiPageId) {
      issues.push({
        path: `flowSchema.states.${stateId}.uiPageId`,
        message: `uiPageId "${state.uiPageId}" does not match UISchema.pageId`,
        severity: 'warning',
        category: 'schema',
      });
    }

    for (const [eventName, transition] of Object.entries(state.on ?? {})) {
      if (!flowSchema.states[transition.target]) {
        issues.push({
          path: `flowSchema.states.${stateId}.on.${eventName}`,
          message: `Transition target "${transition.target}" does not exist`,
          severity: 'error',
          category: 'schema',
        });
      }
    }
  }

  for (const screenId of Object.keys(uiSchemas)) {
    if (!flowSchema.states[screenId]) {
      issues.push({
        path: `uiSchemas.${screenId}`,
        message: `UISchema "${screenId}" is not referenced by the flow schema`,
        severity: 'warning',
        category: 'schema',
      });
    }
  }
}

function validateUiSchema(
  screenId: string,
  schema: UISchema,
  contractMap: Map<string, ComponentContract>,
  issues: ValidationIssue[],
): void {
  if (!schema.pageId) {
    issues.push({
      path: `uiSchemas.${screenId}.pageId`,
      message: 'pageId is required',
      severity: 'error',
      category: 'schema',
    });
  }

  const componentIds = schema.components.map((component) => component.id);
  const duplicateComponents = findDuplicates(componentIds);
  for (const duplicateId of duplicateComponents) {
    issues.push({
      path: `uiSchemas.${screenId}.components`,
      message: `Duplicate component id "${duplicateId}"`,
      severity: 'error',
      category: 'schema',
    });
  }

  const layoutIds = collectLayoutNodeIds(schema.sections ?? []);
  for (const duplicateId of findDuplicates(layoutIds)) {
    issues.push({
      path: `uiSchemas.${screenId}.sections`,
      message: `Duplicate layout node id "${duplicateId}"`,
      severity: 'warning',
      category: 'schema',
    });
  }

  const referencedComponentIds = new Set(collectLayoutComponentIds(schema.sections ?? []));
  const componentIdSet = new Set(componentIds);
  for (const refId of referencedComponentIds) {
    if (!componentIdSet.has(refId)) {
      issues.push({
        path: `uiSchemas.${screenId}.sections`,
        message: `Layout references missing component "${refId}"`,
        severity: 'error',
        category: 'schema',
      });
    }
  }

  for (const component of schema.components) {
    const contract = contractMap.get(component.type);
    if (!contract) {
      issues.push({
        path: `uiSchemas.${screenId}.components.${component.id}.type`,
        message: `Unknown component type "${component.type}"`,
        severity: 'error',
        category: 'schema',
      });
      continue;
    }

    validateComponentProps(screenId, component, contract, issues);
    validateAccessibility(screenId, component, contract, issues);
    validateI18n(screenId, component, issues);

    if (!referencedComponentIds.has(component.id)) {
      issues.push({
        path: `uiSchemas.${screenId}.components.${component.id}`,
        message: 'Component is not placed in the layout tree',
        severity: 'warning',
        category: 'schema',
      });
    }
  }
}

function validateComponentProps(
  screenId: string,
  component: UIComponent,
  contract: ComponentContract,
  issues: ValidationIssue[],
): void {
  const props = component.props ?? {};

  for (const [propKey, definition] of Object.entries(contract.props ?? {})) {
    if (!definition) continue;
    const propValue = props[propKey];
    if (definition.required && !isPresentValue(propValue)) {
      issues.push({
        path: `uiSchemas.${screenId}.components.${component.id}.props.${propKey}`,
        message: `${definition.label ?? propKey} is required`,
        severity: 'error',
        category: 'schema',
      });
      continue;
    }

    if (propValue === undefined || propValue === null) continue;
    validatePropValue(screenId, component, propKey, propValue, definition as ComponentPropDefinition, issues);
  }
}

function validateAccessibility(
  screenId: string,
  component: UIComponent,
  contract: ComponentContract,
  issues: ValidationIssue[],
): void {
  if (!component.accessibility || !isPresentValue(component.accessibility.ariaLabelKey)) {
    issues.push({
      path: `uiSchemas.${screenId}.components.${component.id}.accessibility.ariaLabelKey`,
      message: 'ariaLabelKey is required for accessibility',
      severity: 'error',
      category: 'accessibility',
    });
  }

  const requiredProps = contract.accessibility?.requiredProps ?? [];
  for (const propName of requiredProps) {
    const satisfied =
      propName === 'ariaLabel'
        ? isPresentValue(component.props?.ariaLabel) || isPresentValue(component.accessibility?.ariaLabelKey)
        : isPresentValue(component.props?.[propName]);
    if (!satisfied) {
      issues.push({
        path: `uiSchemas.${screenId}.components.${component.id}.props.${propName}`,
        message: `Accessibility requires ${propName}`,
        severity: 'warning',
        category: 'accessibility',
      });
    }
  }

  const isImage =
    component.type.toLowerCase().includes('image') || component.type.toLowerCase().endsWith('.image');
  if (isImage && !isPresentValue(component.props?.alt)) {
    issues.push({
      path: `uiSchemas.${screenId}.components.${component.id}.props.alt`,
      message: 'Image components must include non-empty alt text',
      severity: 'error',
      category: 'accessibility',
    });
  }
}

function validateI18n(screenId: string, component: UIComponent, issues: ValidationIssue[]): void {
  const i18n = component.i18n;
  const stringLikeKeys = [
    { prop: 'label', key: i18n?.labelKey, path: 'i18n.labelKey' },
    { prop: 'helperText', key: i18n?.helperTextKey, path: 'i18n.helperTextKey' },
    { prop: 'placeholder', key: i18n?.placeholderKey, path: 'i18n.placeholderKey' },
  ];

  for (const entry of stringLikeKeys) {
    const value = component.props?.[entry.prop];
    if (typeof value === 'string' && value.trim().length > 0 && !isPresentValue(entry.key)) {
      issues.push({
        path: `uiSchemas.${screenId}.components.${component.id}.${entry.path}`,
        message: `${entry.path} is required when props.${entry.prop} is set`,
        severity: 'error',
        category: 'i18n',
      });
    }
  }

  if (!isPresentValue(component.accessibility?.ariaLabelKey)) {
    return;
  }

  const ariaLabelKey = component.accessibility.ariaLabelKey;
  if (typeof ariaLabelKey !== 'string' || !ariaLabelKey.includes('.')) {
    issues.push({
      path: `uiSchemas.${screenId}.components.${component.id}.accessibility.ariaLabelKey`,
      message: 'ariaLabelKey should be a translation key path such as "form.submit"',
      severity: 'warning',
      category: 'i18n',
    });
  }
}

function validatePropValue(
  screenId: string,
  component: UIComponent,
  propKey: string,
  value: JSONValue,
  definition: ComponentPropDefinition,
  issues: ValidationIssue[],
): void {
  const path = `uiSchemas.${screenId}.components.${component.id}.props.${propKey}`;

  if (definition.kind === 'string') {
    if (typeof value !== 'string') {
      issues.push({ path, message: 'Expected a string value', severity: 'error', category: 'schema' });
      return;
    }
    if (definition.minLength !== undefined && value.length < definition.minLength) {
      issues.push({
        path,
        message: `Minimum length is ${definition.minLength}`,
        severity: 'error',
        category: 'schema',
      });
    }
    if (definition.maxLength !== undefined && value.length > definition.maxLength) {
      issues.push({
        path,
        message: `Maximum length is ${definition.maxLength}`,
        severity: 'error',
        category: 'schema',
      });
    }
    if (definition.pattern) {
      try {
        const re = new RegExp(definition.pattern);
        if (!re.test(value)) {
          issues.push({ path, message: 'Value does not match required pattern', severity: 'error', category: 'schema' });
        }
      } catch {
        issues.push({ path, message: 'Invalid validation pattern in contract', severity: 'warning', category: 'schema' });
      }
    }
    return;
  }

  if (definition.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ path, message: 'Expected a numeric value', severity: 'error', category: 'schema' });
      return;
    }
    if (definition.min !== undefined && value < definition.min) {
      issues.push({ path, message: `Minimum value is ${definition.min}`, severity: 'error', category: 'schema' });
    }
    if (definition.max !== undefined && value > definition.max) {
      issues.push({ path, message: `Maximum value is ${definition.max}`, severity: 'error', category: 'schema' });
    }
    return;
  }

  if (definition.kind === 'boolean') {
    if (typeof value !== 'boolean') {
      issues.push({ path, message: 'Expected a boolean value', severity: 'error', category: 'schema' });
    }
    return;
  }

  if (definition.kind === 'enum') {
    if (typeof value !== 'string') {
      issues.push({ path, message: 'Expected a string option value', severity: 'error', category: 'schema' });
      return;
    }
    const options = definition.options.map((option) => option.value);
    if (!options.includes(value)) {
      issues.push({ path, message: 'Value is not a valid option', severity: 'error', category: 'schema' });
    }
  }
}

function validateRuleReferences(
  flowSchema: FlowSchema,
  rules: Array<{ ruleId: string }>,
  issues: ValidationIssue[],
): void {
  const ruleIds = new Set(rules.map((rule) => rule.ruleId));
  for (const [stateId, state] of Object.entries(flowSchema.states ?? {})) {
    for (const [eventName, transition] of Object.entries(state.on ?? {})) {
      if (typeof transition.condition === 'string' && transition.condition.startsWith('rule:')) {
        const ruleId = transition.condition.slice('rule:'.length);
        if (ruleId && !ruleIds.has(ruleId)) {
          issues.push({
            path: `flowSchema.states.${stateId}.on.${eventName}.condition`,
            message: `Referenced rule "${ruleId}" does not exist`,
            severity: 'error',
            category: 'schema',
          });
        }
      }
    }
  }
}

function validateThemeContrast(bundle: ApplicationBundle, issues: ValidationIssue[]): void {
  const tokens = bundle.themes?.tokens;
  if (!tokens) return;
  const surface = pickToken(tokens, ['color.surface', 'color.background']);
  const text = pickToken(tokens, ['color.text', 'color.text.primary']);
  if (!surface || !text) return;

  const surfaceRgb = parseColor(surface);
  const textRgb = parseColor(text);
  if (!surfaceRgb || !textRgb) return;

  const ratio = contrastRatio(surfaceRgb, textRgb);
  if (ratio < 4.5) {
    issues.push({
      path: 'themes.tokens',
      message: `Color contrast ratio ${ratio.toFixed(2)} is below 4.5:1`,
      severity: 'warning',
      category: 'accessibility',
    });
  }
}

function normalizeSeverityForDevMode(issues: ValidationIssue[], options: ValidationOptions): ValidationIssue[] {
  const shouldDowngrade = options.developmentMode && options.skipA11yI18nInDev;
  if (!shouldDowngrade) return issues;

  return issues.map((issue) => {
    if (issue.severity === 'error' && (issue.category === 'accessibility' || issue.category === 'i18n')) {
      return {
        ...issue,
        severity: 'warning',
      };
    }
    return issue;
  });
}

function collectLayoutComponentIds(sections: SectionNode[]): string[] {
  const ids: string[] = [];
  const visit = (node: LayoutTreeNode) => {
    if (node.kind === 'component') {
      ids.push(node.componentId);
      return;
    }
    if (node.kind === 'section') {
      node.rows.forEach((row) => row.columns.forEach((column) => column.children.forEach(visit)));
      return;
    }
    if (node.kind === 'row') {
      node.columns.forEach((column) => column.children.forEach(visit));
      return;
    }
    if (node.kind === 'column') {
      node.children.forEach(visit);
    }
  };
  sections.forEach(visit);
  return ids;
}

function collectLayoutNodeIds(sections: SectionNode[]): string[] {
  const ids: string[] = [];
  const visit = (node: LayoutTreeNode) => {
    ids.push(node.id);
    if (node.kind === 'section') {
      node.rows.forEach((row) => row.columns.forEach((column) => column.children.forEach(visit)));
    } else if (node.kind === 'row') {
      node.columns.forEach((column) => column.children.forEach(visit));
    } else if (node.kind === 'column') {
      node.children.forEach(visit);
    }
  };
  sections.forEach(visit);
  return ids;
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }
  return Array.from(duplicates);
}

function isPresentValue(value: JSONValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function pickToken(tokens: Record<string, JSONValue>, keys: string[]): string | null {
  for (const key of keys) {
    const value = tokens[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

type RGB = { r: number; g: number; b: number };

function parseColor(input: string): RGB | null {
  const value = input.trim().toLowerCase();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex.slice(0, 1).repeat(2), 16);
      const g = parseInt(hex.slice(1, 2).repeat(2), 16);
      const b = parseInt(hex.slice(2, 3).repeat(2), 16);
      return { r, g, b };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b };
    }
  }

  const rgbMatch = value.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    const channelList = rgbMatch[1];
    if (!channelList) return null;
    const parts = channelList.split(',').map((part) => part.trim());
    if (parts.length >= 3) {
      const r = Number(parts[0]);
      const g = Number(parts[1]);
      const b = Number(parts[2]);
      if ([r, g, b].every((num) => Number.isFinite(num))) {
        return { r, g, b };
      }
    }
  }
  return null;
}

function contrastRatio(first: RGB, second: RGB): number {
  const l1 = relativeLuminance(first);
  const l2 = relativeLuminance(second);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: RGB): number {
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(color.r);
  const g = toLinear(color.g);
  const b = toLinear(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
