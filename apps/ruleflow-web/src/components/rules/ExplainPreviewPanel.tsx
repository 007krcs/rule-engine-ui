'use client';

import { useMemo, useState } from 'react';
import type { ExecutionContext, JSONValue, RuleSet } from '@platform/schema';
import { evaluateRules } from '@platform/rules-engine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_SIMULATION_CONTEXT,
  DEFAULT_SIMULATION_DATA,
} from './rule-visual-model';
import styles from './explain-preview-panel.module.scss';

type ExplainPreviewPanelProps = {
  ruleSet: RuleSet;
};

function safeParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function asExecutionContext(value: unknown): ExecutionContext | null {
  if (typeof value !== 'object' || value === null) return null;
  const context = value as Partial<ExecutionContext>;
  if (typeof context.tenantId !== 'string') return null;
  if (typeof context.userId !== 'string') return null;
  if (typeof context.role !== 'string') return null;
  if (!Array.isArray(context.roles)) return null;
  if (typeof context.country !== 'string') return null;
  if (typeof context.locale !== 'string') return null;
  if (typeof context.timezone !== 'string') return null;
  if (context.device !== 'mobile' && context.device !== 'tablet' && context.device !== 'desktop') return null;
  if (!Array.isArray(context.permissions)) return null;
  if (typeof context.featureFlags !== 'object' || context.featureFlags === null) return null;
  return context as ExecutionContext;
}

function asDataRecord(value: unknown): Record<string, JSONValue> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, JSONValue>;
}

export function ExplainPreviewPanel({ ruleSet }: ExplainPreviewPanelProps) {
  const [mode, setMode] = useState<'predicate' | 'apply'>('predicate');
  const [contextText, setContextText] = useState(() =>
    JSON.stringify(DEFAULT_SIMULATION_CONTEXT, null, 2),
  );
  const [dataText, setDataText] = useState(() =>
    JSON.stringify(DEFAULT_SIMULATION_DATA, null, 2),
  );
  const [result, setResult] = useState<ReturnType<typeof evaluateRules> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contextParsed = useMemo(() => safeParseJson(contextText), [contextText]);
  const dataParsed = useMemo(() => safeParseJson(dataText), [dataText]);

  const runExplain = () => {
    if (!contextParsed.ok) {
      setError(`Context JSON invalid: ${contextParsed.error}`);
      setResult(null);
      return;
    }
    if (!dataParsed.ok) {
      setError(`Data JSON invalid: ${dataParsed.error}`);
      setResult(null);
      return;
    }
    const context = asExecutionContext(contextParsed.value);
    const data = asDataRecord(dataParsed.value);
    if (!context) {
      setError('Context shape is invalid. Include tenantId, role, roles, country, locale, device, and featureFlags.');
      setResult(null);
      return;
    }
    if (!data) {
      setError('Data must be a JSON object.');
      setResult(null);
      return;
    }

    try {
      const next = evaluateRules({
        rules: ruleSet,
        context,
        data,
        options: { mode },
      });
      setResult(next);
      setError(null);
    } catch (runtimeError) {
      setError(runtimeError instanceof Error ? runtimeError.message : String(runtimeError));
      setResult(null);
    }
  };

  return (
    <section className={styles.panel} aria-label="Explain preview">
      <div className={styles.header}>
        <h3 className={styles.title}>Explain Preview</h3>
        <div className={styles.headerActions}>
          <Select
            value={mode}
            onChange={(event) => setMode(event.target.value as 'predicate' | 'apply')}
            data-testid="rules-simulate-mode"
          >
            <option value="predicate">Predicate mode (no writes)</option>
            <option value="apply">Apply mode (execute actions)</option>
          </Select>
          <Button
            type="button"
            size="sm"
            onClick={runExplain}
            data-testid="rules-simulate-run"
          >
            Run Explain
          </Button>
        </div>
      </div>

      <div className={styles.editors}>
        <div className={styles.editorBlock}>
          <p className={styles.blockTitle}>Sample Context</p>
          <Textarea
            value={contextText}
            onChange={(event) => setContextText(event.target.value)}
            rows={10}
            className={styles.jsonArea}
          />
        </div>
        <div className={styles.editorBlock}>
          <p className={styles.blockTitle}>Sample Data</p>
          <Textarea
            value={dataText}
            onChange={(event) => setDataText(event.target.value)}
            rows={10}
            className={styles.jsonArea}
          />
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {result ? (
        <div className={styles.result} data-testid="rules-simulate-result">
          <p className={styles.summary}>
            Matched {result.trace.rulesMatched.length}/{result.trace.rulesConsidered.length} rules in {result.trace.durationMs}ms.
          </p>
          <div className={styles.ruleRows}>
            {result.trace.rulesConsidered.map((ruleId) => {
              const matched = result.trace.rulesMatched.includes(ruleId);
              const reads = result.trace.readsByRuleId?.[ruleId] ?? [];
              const diffs = (result.trace.actionDiffs ?? []).filter((diff) => diff.ruleId === ruleId);
              return (
                <details key={`${ruleId}-explain`} className={styles.ruleDetail}>
                  <summary className={styles.ruleSummary}>
                    <span className={styles.ruleId}>{ruleId}</span>
                    <Badge variant={matched ? 'success' : 'muted'}>
                      {matched ? 'Matched' : 'Skipped'}
                    </Badge>
                  </summary>
                  <div className={styles.ruleBody}>
                    <p className={styles.subHeading}>Reads</p>
                    {reads.length > 0 ? (
                      <ul className={styles.list}>
                        {reads.map((read) => (
                          <li key={`${ruleId}-${read.path}`} className={styles.listItem}>
                            <span className={styles.mono}>{read.path}</span> = {JSON.stringify(read.value)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.empty}>No reads captured for this rule.</p>
                    )}
                    <p className={styles.subHeading}>Diffs</p>
                    {diffs.length > 0 ? (
                      <ul className={styles.list}>
                        {diffs.map((diff, index) => (
                          <li key={`${ruleId}-${diff.path}-${index}`} className={styles.listItem}>
                            <span className={styles.mono}>{diff.target}.{diff.path}</span> {JSON.stringify(diff.before)} {'->'}{' '}
                            {JSON.stringify(diff.after)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.empty}>No writes for this rule.</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
