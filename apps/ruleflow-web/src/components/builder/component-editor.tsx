'use client';

import type { UIComponent } from '@platform/schema';
import type { ValidationIssue } from '@platform/validator';
import { ArrowDown, ArrowUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function pickFieldIssues(issues: ValidationIssue[] | undefined, predicate: (path: string) => boolean) {
  if (!issues || issues.length === 0) return [];
  return issues.filter((issue) => predicate(issue.path));
}

function firstMessage(issues: ValidationIssue[]) {
  return issues.length > 0 ? issues[0]?.message : undefined;
}

export function ComponentEditor({
  component,
  issues,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onChange,
  onRemove,
}: {
  component: UIComponent;
  issues?: ValidationIssue[];
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onChange: (component: UIComponent) => void;
  onRemove: () => void;
}) {
  const adapterHintIssues = pickFieldIssues(issues, (path) => path.endsWith('.adapterHint'));
  const labelKeyIssues = pickFieldIssues(issues, (path) => path.includes('.i18n.labelKey'));
  const placeholderIssues = pickFieldIssues(issues, (path) => path.includes('.i18n.placeholderKey'));
  const ariaIssues = pickFieldIssues(issues, (path) => path.endsWith('.accessibility.ariaLabelKey'));
  const focusIssues = pickFieldIssues(issues, (path) => path.endsWith('.accessibility.focusOrder'));

  const hasIssues = (issues?.length ?? 0) > 0;

  return (
    <Card className={cn(hasIssues ? 'border-amber-500/40' : undefined)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span className="truncate">{component.id}</span>
              {hasIssues ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {issues?.length} issue{issues?.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{component.type}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="muted" className="hidden sm:inline-flex">
              {component.adapterHint}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label="Move up"
              title={!canMoveUp ? 'Already at top' : 'Move up'}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label="Move down"
              title={!canMoveDown ? 'Already at bottom' : 'Move down'}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {hasIssues ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
            {issues?.slice(0, 3).map((issue) => (
              <p key={`${issue.path}-${issue.message}`}>
                <span className="font-mono">{issue.path || 'root'}</span>: {issue.message}
              </p>
            ))}
            {(issues?.length ?? 0) > 3 ? <p>…</p> : null}
          </div>
        ) : null}

        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Adapter Hint</label>
          <Input value={component.adapterHint} onChange={(event) => onChange({ ...component, adapterHint: event.target.value })} />
          {firstMessage(adapterHintIssues) ? <p className="mt-1 text-xs text-amber-500">{firstMessage(adapterHintIssues)}</p> : null}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Label Key</label>
          <Input
            value={component.i18n?.labelKey ?? ''}
            onChange={(event) => onChange({ ...component, i18n: { ...(component.i18n ?? {}), labelKey: event.target.value } })}
          />
          {firstMessage(labelKeyIssues) ? <p className="mt-1 text-xs text-amber-500">{firstMessage(labelKeyIssues)}</p> : null}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Placeholder Key</label>
          <Input
            value={component.i18n?.placeholderKey ?? ''}
            onChange={(event) =>
              onChange({ ...component, i18n: { ...(component.i18n ?? {}), placeholderKey: event.target.value } })
            }
          />
          {firstMessage(placeholderIssues) ? <p className="mt-1 text-xs text-amber-500">{firstMessage(placeholderIssues)}</p> : null}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Aria Label Key</label>
          <Input
            value={component.accessibility?.ariaLabelKey ?? ''}
            onChange={(event) =>
              onChange({
                ...component,
                accessibility: { ...(component.accessibility ?? {}), ariaLabelKey: event.target.value, keyboardNav: true, focusOrder: component.accessibility?.focusOrder ?? 1 },
              })
            }
          />
          {firstMessage(ariaIssues) ? <p className="mt-1 text-xs text-amber-500">{firstMessage(ariaIssues)}</p> : null}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Focus Order</label>
          <Input
            type="number"
            value={component.accessibility?.focusOrder ?? 1}
            onChange={(event) =>
              onChange({
                ...component,
                accessibility: {
                  ...(component.accessibility ?? {}),
                  focusOrder: Number(event.target.value) || 1,
                  keyboardNav: true,
                  ariaLabelKey: component.accessibility?.ariaLabelKey ?? 'runtime.aria.missing',
                },
              })
            }
          />
          {firstMessage(focusIssues) ? <p className="mt-1 text-xs text-amber-500">{firstMessage(focusIssues)}</p> : null}
        </div>

        <Button variant="outline" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </CardContent>
    </Card>
  );
}

