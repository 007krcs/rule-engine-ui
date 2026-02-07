import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import type { TranslationBundle } from '@platform/i18n';
import type { ApiMapping, ExecutionContext, FlowSchema, RuleSet, UISchema } from '@platform/schema';
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

const ajv = new Ajv({ allErrors: true, strict: false });
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
  return mergeResults(validateWithSchema(validators.ui, value), validateAccessibility(value));
}

export function validateFlowSchema(value: FlowSchema): ValidationResult {
  return validateWithSchema(validators.flow, value);
}

export function validateRulesSchema(value: RuleSet): ValidationResult {
  return validateWithSchema(validators.rules, value);
}

export function validateApiMapping(value: ApiMapping): ValidationResult {
  return validateWithSchema(validators.api, value);
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
