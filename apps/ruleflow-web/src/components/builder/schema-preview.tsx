'use client';

import type { UISchema } from '@platform/schema';
import type { ValidationIssue } from '@platform/validator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import styles from './schema-preview.module.css';

export function SchemaPreview({
  schema,
  issues,
  resolveComponentId,
  onFocusComponentId,
}: {
  schema: UISchema;
  issues: ValidationIssue[];
  resolveComponentId?: (path: string) => string | null;
  onFocusComponentId?: (componentId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className={styles.headerRow}>
          <CardTitle>Schema Preview</CardTitle>
          <Badge variant={issues.length === 0 ? 'success' : 'warning'}>
            {issues.length === 0 ? 'Valid' : `${issues.length} Issues`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={styles.content}>
        {issues.length > 0 ? (
          <ul className={styles.issuesList}>
            {issues.map((issue) => {
              const componentId = resolveComponentId ? resolveComponentId(issue.path) : null;
              const canFocus = Boolean(componentId && onFocusComponentId);
              return (
                <li key={`${issue.path}-${issue.message}`} className={styles.issueItem}>
                  {canFocus ? (
                    <button
                      type="button"
                      className={styles.issueButton}
                      onClick={() => onFocusComponentId?.(componentId!)}
                      title={`Focus component: ${componentId}`}
                    >
                      <span className={styles.issuePath}>{issue.path}</span>: {issue.message}
                    </button>
                  ) : (
                    <span>
                      <span className={styles.issuePath}>{issue.path}</span>: {issue.message}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        <pre className={styles.code}>{JSON.stringify(schema, null, 2)}</pre>
      </CardContent>
    </Card>
  );
}
