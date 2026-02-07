import type { UISchema } from '@platform/schema';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function validateAccessibility(uiSchema: UISchema): ValidationResult {
  const issues: ValidationIssue[] = [];
  for (const component of uiSchema.components) {
    if (!component.accessibility?.ariaLabel) {
      issues.push({
        path: `components.${component.id}.accessibility.ariaLabel`,
        message: 'ariaLabel is required',
        severity: 'error',
      });
    }
  }
  return { valid: issues.length === 0, issues };
}
