'use client';

import type { UISchema } from '@platform/schema';
import type { ValidationIssue } from '@platform/validator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
        <div className="flex items-center justify-between">
          <CardTitle>Schema Preview</CardTitle>
          <Badge variant={issues.length === 0 ? 'success' : 'warning'}>
            {issues.length === 0 ? 'Valid' : `${issues.length} Issues`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        {issues.length > 0 && (
          <ul className="space-y-1 text-sm text-amber-500">
            {issues.map((issue) => (
              <li key={`${issue.path}-${issue.message}`}>
                {issue.path}: {issue.message}
              </li>
            ))}
          </ul>
        )}
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-muted/40 p-3 text-xs text-foreground">
          {JSON.stringify(schema, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
