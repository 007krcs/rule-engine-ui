'use client';

import type { UISchema } from '@platform/schema';
import type { ValidationIssue } from '@platform/validator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import styles from './schema-preview.module.css';

export function SchemaPreview({
  schema,
  issues,
}: {
  schema: UISchema;
  issues: ValidationIssue[];
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
            {issues.map((issue) => (
              <li key={`${issue.path}-${issue.message}`}>
                <span className={styles.issuePath}>{issue.path}</span>: {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
        <pre className={styles.code}>{JSON.stringify(schema, null, 2)}</pre>
      </CardContent>
    </Card>
  );
}

