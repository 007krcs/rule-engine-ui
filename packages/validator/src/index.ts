import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';
import type { TranslationBundle } from '@platform/i18n';
import type { ApiMapping, ExecutionContext, FlowSchema, JSONValue, RuleSet, UISchema } from '@platform/schema';
import {
  apiMappingSchema,
  executionContextSchema,
  flowSchema,
  rulesSchema,
  uiSchema,
} from '@platform/schema';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = {
  executionContext: ajv.compile(executionContextSchema),
  ui: ajv.compile(uiSchema),
  flow: ajv.compile(flowSchema),
  rules: ajv.compile(rulesSchema),
  api: ajv.compile(apiMappingSchema),
};

export function validateExecutionContext(value: ExecutionContext): ValidationResult {
  return validateWithSchema(validators.executionContext, value);
}

export function validateUISchema(value: UISchema): ValidationResult {
  return mergeResults(
    validateWithSchema(validators.ui, value),
    validateAccessibility(value),
    validateI18nKeyUsage(value),
    validateComponentDateValidations(value),
  );
}

export function validateFlowSchema(value: FlowSchema): ValidationResult {
  return validateWithSchema(validators.flow, value);
}

export function validateRulesSchema(value: RuleSet): ValidationResult {
  return mergeResults(validateWithSchema(validators.rules, value), validateDateOperators(value));
}

export function validateApiMapping(value: ApiMapping): ValidationResult {
  return validateWithSchema(validators.api, value);
}

export function assertExecutionContext(value: ExecutionContext): void {
  assertValid('ExecutionContext', validateExecutionContext(value));
}

export function assertUISchema(value: UISchema): void {
  assertValid('UISchema', validateUISchema(value));
}

export function assertFlowSchema(value: FlowSchema): void {
  assertValid('FlowSchema', validateFlowSchema(value));
}

export function assertRulesSchema(value: RuleSet): void {
  assertValid('RuleSet', validateRulesSchema(value));
}

export function assertApiMapping(value: ApiMapping): void {
  assertValid('ApiMapping', validateApiMapping(value));
}

export function assertI18nCoverage(uiSchemaValue: UISchema, options: I18nCoverageOptions): void {
  assertValid('I18nCoverage', validateI18nCoverage(uiSchemaValue, options));
}

export function assertAccessibility(uiSchemaValue: UISchema): void {
  assertValid('Accessibility', validateAccessibility(uiSchemaValue));
}

export interface I18nCoverageOptions {
  locales: string[];
  bundles: TranslationBundle[];
  defaultNamespace?: string;
}

export function validateI18nCoverage(uiSchemaValue: UISchema, options: I18nCoverageOptions): ValidationResult {
  const issues: ValidationIssue[] = [];
  const keys = collectI18nKeys(uiSchemaValue, options.defaultNamespace ?? 'runtime');

  for (const locale of options.locales) {
    for (const ref of keys) {
      if (!hasMessage(options.bundles, locale, ref.namespace, ref.key)) {
        issues.push({
          path: ref.path,
          message: `Missing translation for ${locale}:${ref.namespace}.${ref.key}`,
          severity: 'error',
        });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

export function validateAccessibility(uiSchemaValue: UISchema): ValidationResult {
  const issues: ValidationIssue[] = [];
  const focusOrders = new Map<number, string>();

  for (const component of uiSchemaValue.components) {
    const basePath = `components.${component.id}.accessibility`;
    const accessibility = component.accessibility;

    if (!accessibility) {
      issues.push({
        path: basePath,
        message: 'accessibility metadata is required',
        severity: 'error',
      });
      continue;
    }

    if (!accessibility.ariaLabelKey || accessibility.ariaLabelKey.trim().length === 0) {
      issues.push({
        path: `${basePath}.ariaLabelKey`,
        message: 'ariaLabelKey is required',
        severity: 'error',
      });
    }

    if (accessibility.keyboardNav !== true) {
      issues.push({
        path: `${basePath}.keyboardNav`,
        message: 'keyboardNav must be true',
        severity: 'error',
      });
    }

    const focusOrder = accessibility.focusOrder;
    if (typeof focusOrder !== 'number' || !Number.isInteger(focusOrder) || focusOrder < 1) {
      issues.push({
        path: `${basePath}.focusOrder`,
        message: 'focusOrder must be an integer >= 1',
        severity: 'error',
      });
    } else {
      const existing = focusOrders.get(focusOrder);
      if (existing) {
        issues.push({
          path: `${basePath}.focusOrder`,
          message: `focusOrder ${focusOrder} is already used by ${existing}`,
          severity: 'error',
        });
      } else {
        focusOrders.set(focusOrder, component.id);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

function validateWithSchema(validator: ValidateFunction, value: unknown): ValidationResult {
  const valid = validator(value);
  if (valid) return { valid: true, issues: [] };
  return { valid: false, issues: toIssues(validator.errors) };
}

function toIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  if (!errors) return [];
  return errors.map((error) => {
    const path = resolvePath(error);
    return {
      path,
      message: error.message ?? 'Schema validation error',
      severity: 'error',
    };
  });
}

function resolvePath(error: ErrorObject): string {
  const instancePath = pointerToPath(error.instancePath);
  if (error.keyword === 'required' && typeof error.params === 'object') {
    const params = error.params as { missingProperty?: string };
    if (params.missingProperty) {
      return instancePath ? `${instancePath}.${params.missingProperty}` : params.missingProperty;
    }
  }
  return instancePath;
}

function pointerToPath(pointer: string): string {
  if (!pointer) return '';
  return pointer
    .split('/')
    .filter((part) => part.length > 0)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.');
}

function mergeResults(...results: ValidationResult[]): ValidationResult {
  const issues = results.flatMap((result) => result.issues);
  return { valid: issues.length === 0, issues };
}

function validateI18nKeyUsage(uiSchemaValue: UISchema): ValidationResult {
  const issues: ValidationIssue[] = [];
  for (const component of uiSchemaValue.components) {
    const props = component.props as Record<string, JSONValue> | undefined;
    if (!props) continue;

    const label = props.label;
    if (typeof label === 'string' && label.trim().length > 0) {
      issues.push({
        path: `components.${component.id}.props.label`,
        message: 'Use i18n.labelKey instead of a raw label string',
        severity: 'error',
      });
    }

    const helperText = props.helperText;
    if (typeof helperText === 'string' && helperText.trim().length > 0) {
      issues.push({
        path: `components.${component.id}.props.helperText`,
        message: 'Use i18n.helperTextKey instead of a raw helperText string',
        severity: 'error',
      });
    }

    const placeholder = props.placeholder;
    if (typeof placeholder === 'string' && placeholder.trim().length > 0) {
      issues.push({
        path: `components.${component.id}.props.placeholder`,
        message: 'Use i18n.placeholderKey instead of a raw placeholder string',
        severity: 'error',
      });
    }

    const ariaLabel = props.ariaLabel;
    if (typeof ariaLabel === 'string' && ariaLabel.trim().length > 0) {
      issues.push({
        path: `components.${component.id}.props.ariaLabel`,
        message: 'Use accessibility.ariaLabelKey instead of a raw ariaLabel string',
        severity: 'error',
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

function validateComponentDateValidations(uiSchemaValue: UISchema): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const component of uiSchemaValue.components) {
    const validations = component.validations;
    if (!validations) continue;
    const basePath = `components.${component.id}.validations`;

    if (validations.minDate && !isIsoDateString(validations.minDate)) {
      issues.push({
        path: `${basePath}.minDate`,
        message: 'minDate must use YYYY-MM-DD format',
        severity: 'error',
      });
    }

    if (validations.maxDate && !isIsoDateString(validations.maxDate)) {
      issues.push({
        path: `${basePath}.maxDate`,
        message: 'maxDate must use YYYY-MM-DD format',
        severity: 'error',
      });
    }

    if (validations.minDate && validations.maxDate && validations.minDate > validations.maxDate) {
      issues.push({
        path: basePath,
        message: 'minDate cannot be after maxDate',
        severity: 'error',
      });
    }

    if (validations.minTime && !isTimeString(validations.minTime)) {
      issues.push({
        path: `${basePath}.minTime`,
        message: 'minTime must use HH:mm format',
        severity: 'error',
      });
    }

    if (validations.maxTime && !isTimeString(validations.maxTime)) {
      issues.push({
        path: `${basePath}.maxTime`,
        message: 'maxTime must use HH:mm format',
        severity: 'error',
      });
    }

    if (validations.minTime && validations.maxTime && validations.minTime > validations.maxTime) {
      issues.push({
        path: basePath,
        message: 'minTime cannot be after maxTime',
        severity: 'error',
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

function assertValid(label: string, result: ValidationResult): void {
  if (result.valid) return;
  const details = result.issues.map((issue) => `${issue.path || 'root'}: ${issue.message}`).join('; ');
  throw new Error(`${label} validation failed: ${details}`);
}

type I18nKeyRef = {
  key: string;
  namespace: string;
  path: string;
};

function collectI18nKeys(uiSchemaValue: UISchema, defaultNamespace: string): I18nKeyRef[] {
  const refs: I18nKeyRef[] = [];
  for (const component of uiSchemaValue.components) {
    const i18n = component.i18n;
    if (i18n?.labelKey) refs.push(toKeyRef(i18n.labelKey, defaultNamespace, `${component.id}.i18n.labelKey`));
    if (i18n?.helperTextKey)
      refs.push(toKeyRef(i18n.helperTextKey, defaultNamespace, `${component.id}.i18n.helperTextKey`));
    if (i18n?.placeholderKey)
      refs.push(toKeyRef(i18n.placeholderKey, defaultNamespace, `${component.id}.i18n.placeholderKey`));
    if (component.accessibility?.ariaLabelKey) {
      refs.push(
        toKeyRef(
          component.accessibility.ariaLabelKey,
          defaultNamespace,
          `${component.id}.accessibility.ariaLabelKey`,
        ),
      );
    }
  }
  return refs;
}

function toKeyRef(fullKey: string, defaultNamespace: string, path: string): I18nKeyRef {
  const { namespace, key } = splitI18nKey(fullKey, defaultNamespace);
  return { namespace, key, path };
}

function splitI18nKey(fullKey: string, defaultNamespace: string): { namespace: string; key: string } {
  if (fullKey.includes(':')) {
    const [namespace, key] = fullKey.split(':', 2);
    return { namespace: namespace || defaultNamespace, key: key ?? fullKey };
  }
  if (fullKey.includes('.')) {
    const [namespace, ...rest] = fullKey.split('.');
    const entryKey = rest.length > 0 ? rest.join('.') : fullKey;
    return { namespace: namespace || defaultNamespace, key: entryKey };
  }
  return { namespace: defaultNamespace, key: fullKey };
}

function hasMessage(bundles: TranslationBundle[], locale: string, namespace: string, key: string): boolean {
  for (const bundle of bundles) {
    if (bundle.locale !== locale || bundle.namespace !== namespace) continue;
    if (bundle.messages[key] !== undefined) return true;
  }
  return false;
}

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function isTimeString(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value.trim());
}

function validateDateOperators(value: RuleSet): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!value || typeof value !== 'object' || !Array.isArray(value.rules)) {
    return { valid: true, issues };
  }

  value.rules.forEach((rule, ruleIndex) => {
    collectDateIssues(rule.when, `rules.${ruleIndex}.when`, issues);
  });

  return { valid: issues.length === 0, issues };
}

function collectDateIssues(condition: unknown, path: string, issues: ValidationIssue[]): void {
  if (!condition || typeof condition !== 'object') return;
  const rec = condition as Record<string, unknown>;
  if (Array.isArray(rec.all)) {
    rec.all.forEach((child, index) => collectDateIssues(child, `${path}.all.${index}`, issues));
    return;
  }
  if (Array.isArray(rec.any)) {
    rec.any.forEach((child, index) => collectDateIssues(child, `${path}.any.${index}`, issues));
    return;
  }
  if (rec.not) {
    collectDateIssues(rec.not, `${path}.not`, issues);
    return;
  }

  const op = rec.op;
  if (op !== 'dateEq' && op !== 'dateBefore' && op !== 'dateAfter' && op !== 'dateBetween') return;
  const left = rec.left as Record<string, unknown> | undefined;
  const right = rec.right as Record<string, unknown> | undefined;

  if (!right) {
    issues.push({ path, message: 'date comparisons require a right operand', severity: 'error' });
    return;
  }

  if (!isValidDateOperand(left, false)) {
    issues.push({ path: `${path}.left`, message: 'date operands must be a path or ISO date string', severity: 'error' });
  }

  if (!isValidDateOperand(right, op === 'dateBetween')) {
    const message = op === 'dateBetween'
      ? 'dateBetween requires a path or [start, end] ISO date array'
      : 'date operands must be a path or ISO date string';
    issues.push({ path: `${path}.right`, message, severity: 'error' });
  }
}

function isValidDateOperand(operand: Record<string, unknown> | undefined, allowRange: boolean): boolean {
  if (!operand || typeof operand !== 'object') return false;
  if ('path' in operand && typeof operand.path === 'string' && operand.path.length > 0) {
    return true;
  }
  if (!('value' in operand)) return false;
  const value = operand.value as JSONValue;
  if (allowRange && Array.isArray(value)) {
    if (value.length < 2) return false;
    return isValidDateLiteral(value[0] as JSONValue) && isValidDateLiteral(value[1] as JSONValue);
  }
  return isValidDateLiteral(value);
}

function isValidDateLiteral(value: JSONValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number' && Number.isFinite(value)) return true;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return true;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(trimmed)) return true;
  return false;
}
