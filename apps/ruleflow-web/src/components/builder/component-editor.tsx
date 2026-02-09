'use client';

import type { UIComponent } from '@platform/schema';
import type { ValidationIssue } from '@platform/validator';
import { AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import styles from './component-editor.module.css';

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
  const showReorderControls = Boolean(onMoveUp) || Boolean(onMoveDown);

  return (
    <Card className={cn(hasIssues ? styles.cardIssues : undefined)}>
      <CardHeader>
        <div className={styles.headerRow}>
          <div className={styles.titleWrap}>
            <CardTitle className={styles.titleLine}>
              <span className={styles.componentId}>{component.id}</span>
              {hasIssues ? (
                <span className={styles.issuesPill}>
                  <AlertTriangle size={14} aria-hidden="true" focusable="false" />
                  {issues?.length} issue{issues?.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </CardTitle>
            <p className={styles.typeText}>{component.type}</p>
          </div>

          <div className={styles.controls}>
            <Badge variant="muted" className={styles.adapterBadge}>
              {component.adapterHint}
            </Badge>
            {showReorderControls ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={styles.iconButton}
                  onClick={onMoveUp}
                  disabled={!canMoveUp}
                  aria-label="Move up"
                  title={!canMoveUp ? 'Already at top' : 'Move up'}
                >
                  <ArrowUp size={16} aria-hidden="true" focusable="false" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={styles.iconButton}
                  onClick={onMoveDown}
                  disabled={!canMoveDown}
                  aria-label="Move down"
                  title={!canMoveDown ? 'Already at bottom' : 'Move down'}
                >
                  <ArrowDown size={16} aria-hidden="true" focusable="false" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className={styles.content}>
        {hasIssues ? (
          <div className={styles.issuesBox} role="status" aria-live="polite">
            {issues?.slice(0, 3).map((issue) => (
              <p key={`${issue.path}-${issue.message}`}>
                <span className={styles.issuePath}>{issue.path || 'root'}</span>: {issue.message}
              </p>
            ))}
            {(issues?.length ?? 0) > 3 ? <p>...</p> : null}
          </div>
        ) : null}

        <div className={styles.field}>
          <label className="rfFieldLabel">Adapter Hint</label>
          <Input value={component.adapterHint} onChange={(event) => onChange({ ...component, adapterHint: event.target.value })} />
          {firstMessage(adapterHintIssues) ? <p className={styles.fieldError}>{firstMessage(adapterHintIssues)}</p> : null}
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Label Key</label>
          <Input
            value={component.i18n?.labelKey ?? ''}
            onChange={(event) => onChange({ ...component, i18n: { ...(component.i18n ?? {}), labelKey: event.target.value } })}
          />
          {firstMessage(labelKeyIssues) ? <p className={styles.fieldError}>{firstMessage(labelKeyIssues)}</p> : null}
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Placeholder Key</label>
          <Input
            value={component.i18n?.placeholderKey ?? ''}
            onChange={(event) =>
              onChange({ ...component, i18n: { ...(component.i18n ?? {}), placeholderKey: event.target.value } })
            }
          />
          {firstMessage(placeholderIssues) ? <p className={styles.fieldError}>{firstMessage(placeholderIssues)}</p> : null}
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Aria Label Key</label>
          <Input
            value={component.accessibility?.ariaLabelKey ?? ''}
            onChange={(event) =>
              onChange({
                ...component,
                accessibility: {
                  ...(component.accessibility ?? {}),
                  ariaLabelKey: event.target.value,
                  keyboardNav: true,
                  focusOrder: component.accessibility?.focusOrder ?? 1,
                },
              })
            }
          />
          {firstMessage(ariaIssues) ? <p className={styles.fieldError}>{firstMessage(ariaIssues)}</p> : null}
        </div>

        <div className={styles.field}>
          <label className="rfFieldLabel">Focus Order</label>
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
          {firstMessage(focusIssues) ? <p className={styles.fieldError}>{firstMessage(focusIssues)}</p> : null}
        </div>

        <div className={styles.removeRow}>
          <Button variant="outline" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
