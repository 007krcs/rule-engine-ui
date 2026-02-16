'use client';

import { useEffect, useState } from 'react';
import type { UISchema } from '@platform/schema';
import type { ValidationIssue } from '@platform/validator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import styles from './schema-preview.module.css';

export function SchemaPreview({
  schema,
  issues,
  resolveComponentId,
  onFocusComponentId,
  onSchemaChange,
}: {
  schema: UISchema;
  issues: ValidationIssue[];
  resolveComponentId?: (path: string) => string | null;
  onFocusComponentId?: (componentId: string) => void;
  onSchemaChange?: (nextSchema: UISchema) => void;
}) {
  const [schemaText, setSchemaText] = useState(() => JSON.stringify(schema, null, 2));
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    setSchemaText(JSON.stringify(schema, null, 2));
    setSchemaError(null);
  }, [schema]);

  const updateSchemaText = (raw: string) => {
    setSchemaText(raw);
    if (!onSchemaChange) return;

    try {
      const parsed = JSON.parse(raw) as UISchema;
      onSchemaChange(parsed);
      setSchemaError(null);
    } catch (error) {
      setSchemaError(error instanceof Error ? error.message : String(error));
    }
  };

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
        <label className="rfFieldLabel" htmlFor="builder-schema-json">
          Schema JSON
        </label>
        <Textarea
          id="builder-schema-json"
          aria-label="Schema JSON editor"
          className={styles.code}
          value={schemaText}
          onChange={(event) => updateSchemaText(event.target.value)}
          spellCheck={false}
        />
        {schemaError ? <p className={styles.errorText}>Invalid JSON: {schemaError}</p> : null}
      </CardContent>
    </Card>
  );
}
