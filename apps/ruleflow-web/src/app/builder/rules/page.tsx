'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Rule, RuleSet } from '@platform/schema';
import { validateRulesSchema } from '@platform/validator';
import type { ConfigVersion } from '@/lib/demo/types';
import { apiGet, apiPatch } from '@/lib/demo/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import styles from './rules.module.css';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';

type GetVersionResponse = { ok: true; version: ConfigVersion } | { ok: false; error: string };

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function nextRuleId(existing: Set<string>, base = 'ONBOARDING_RULE') {
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

function addBeginnerRule(rules: RuleSet): RuleSet {
  const existing = new Set((rules.rules ?? []).map((r) => r.ruleId));
  const ruleId = nextRuleId(existing);

  const nextRule: Rule = {
    ruleId,
    description: 'Beginner rule: set a flag so you can see it in Explain mode.',
    priority: 150,
    when: {
      op: 'eq',
      left: { path: 'context.country' },
      right: { value: 'US' },
    },
    actions: [
      { type: 'setField', path: 'data.beginnerRuleApplied', value: true },
      { type: 'emitEvent', event: 'beginnerRuleApplied', payload: { ruleId } },
    ],
  };

  return {
    ...rules,
    rules: [nextRule, ...(rules.rules ?? [])],
  };
}

export default function RulesBuilderPage() {
  const searchParams = useSearchParams();
  const versionId = searchParams.get('versionId');
  const { toast } = useToast();
  const onboarding = useOnboarding();

  const [loading, setLoading] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState<ConfigVersion | null>(null);
  const [rulesText, setRulesText] = useState('');
  const [dirty, setDirty] = useState(false);
  const lastLoadedVersionId = useRef<string | null>(null);

  const parsed = useMemo(() => safeJsonParse(rulesText), [rulesText]);
  const validation = useMemo(() => {
    if (!parsed.ok) return { valid: false, issues: [{ path: 'rules', message: parsed.error, severity: 'error' as const }] };
    return validateRulesSchema(parsed.value as RuleSet);
  }, [parsed]);

  const loadFromStore = async (force?: boolean) => {
    if (!versionId) return;
    if (!force && dirty) {
      toast({ variant: 'info', title: 'Unsaved changes', description: 'Format/Save or Reload with force.' });
      return;
    }

    setLoading(true);
    try {
      const response = await apiGet<GetVersionResponse>(`/api/config-versions/${encodeURIComponent(versionId)}`);
      if (!response.ok) throw new Error(response.error);
      setLoadedVersion(response.version);
      setRulesText(JSON.stringify(response.version.bundle.rules, null, 2));
      setDirty(false);
      lastLoadedVersionId.current = versionId;
      toast({ variant: 'info', title: 'Loaded rules', description: response.version.version });
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load rules', description: error instanceof Error ? error.message : String(error) });
      setLoadedVersion(null);
      setRulesText('');
      setDirty(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!versionId) return;
    if (versionId === lastLoadedVersionId.current) return;
    void loadFromStore(true);
  }, [versionId]);

  const format = () => {
    if (!parsed.ok) {
      toast({ variant: 'error', title: 'Cannot format invalid JSON', description: parsed.error });
      return;
    }
    setRulesText(JSON.stringify(parsed.value, null, 2));
    setDirty(true);
  };

  const insertBeginnerRule = () => {
    if (!parsed.ok) {
      toast({ variant: 'error', title: 'Fix JSON first', description: parsed.error });
      return;
    }
    const next = addBeginnerRule(parsed.value as RuleSet);
    setRulesText(JSON.stringify(next, null, 2));
    setDirty(true);
    toast({ variant: 'success', title: 'Inserted a starter rule', description: 'Save to persist it.' });
  };

  const save = async () => {
    if (!versionId) {
      toast({ variant: 'error', title: 'No versionId', description: 'Clone a sample first (or create a New Config).' });
      return;
    }
    if (!parsed.ok) {
      toast({ variant: 'error', title: 'Invalid JSON', description: parsed.error });
      return;
    }
    if (!validation.valid) {
      toast({ variant: 'error', title: 'Fix validation issues before saving', description: `${validation.issues.length} issue(s)` });
      return;
    }

    setLoading(true);
    try {
      const result = await apiPatch<{ ok: true } | { ok: false; error: string }>(
        `/api/config-versions/${encodeURIComponent(versionId)}/rules`,
        {
          rules: parsed.value,
        },
      );
      if (!result.ok) throw new Error(result.error);
      toast({ variant: 'success', title: 'Saved rule set' });
      setDirty(false);
      onboarding.setActiveVersionId(versionId);
      onboarding.completeStep('editRules');
      await loadFromStore(true);
    } catch (error) {
      toast({ variant: 'error', title: 'Save failed', description: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {!versionId ? (
        <Card className={styles.hintCard}>
          <CardHeader>
            <CardTitle>Start with a sample</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={styles.hintText}>
              Rules are stored per config version. Clone a sample project first, then come back here with a{' '}
              <span className="rfCodeInline">versionId</span>.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className={styles.headerRow}>
            <div>
              <CardTitle>Rules Builder</CardTitle>
              <p className={styles.subtext}>
                {versionId ? (
                  <>
                    Editing <span className="rfCodeInline">{versionId}</span>
                    {loadedVersion ? ` - ${loadedVersion.status}` : null}
                  </>
                ) : (
                  'Open this page with ?versionId=...'
                )}
              </p>
            </div>
            <div className={styles.actions}>
              <Button variant="outline" size="sm" onClick={() => void loadFromStore(true)} disabled={!versionId || loading}>
                Reload
              </Button>
              <Button variant="outline" size="sm" onClick={format} disabled={!versionId || loading || !parsed.ok}>
                Format
              </Button>
              <Button variant="outline" size="sm" onClick={insertBeginnerRule} disabled={!versionId || loading}>
                Add starter rule
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={!versionId || loading || !validation.valid || !dirty}>
                {loading ? 'Working...' : 'Save'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={styles.grid2}>
          <div className={styles.field}>
            <label className="rfFieldLabel">RuleSet JSON</label>
            <Textarea
              className={styles.textarea}
              value={rulesText}
              placeholder={versionId ? 'Loading...' : 'Clone a sample config to begin.'}
              onChange={(event) => {
                setRulesText(event.target.value);
                setDirty(true);
              }}
              disabled={!versionId || loading}
            />
            <p className="rfHelperText">
              Tip: click <strong>Add starter rule</strong>, then <strong>Save</strong>, then go to Playground and hit{' '}
              <strong>Submit</strong> to see Explain mode.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <Card>
              <CardHeader>
                <CardTitle>Validation</CardTitle>
              </CardHeader>
              <CardContent>
                <p style={{ margin: 0, color: validation.valid ? 'var(--rf-success)' : 'var(--rf-muted)', fontSize: 13 }}>
                  {validation.valid ? 'Valid RuleSet' : `${validation.issues.length} issue(s)`}
                </p>
                {!validation.valid ? (
                  <div style={{ height: 10 }} />
                ) : (
                  <p className="rfHelperText" style={{ marginTop: 10 }}>
                    Save is enabled once you make changes and the JSON validates.
                  </p>
                )}
                {!validation.valid ? (
                  <div className={styles.issuesBox} role="status" aria-live="polite">
                    {validation.issues.slice(0, 6).map((issue) => (
                      <p key={`${issue.path}-${issue.message}`} className={styles.issueLine}>
                        <span className={styles.issuePath}>{issue.path || 'root'}</span>: {issue.message}
                      </p>
                    ))}
                    {validation.issues.length > 6 ? <p className={styles.issueLine}>...</p> : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="rfHelperText" style={{ marginTop: 0 }}>
                  After saving rules, open Playground and run Submit. Then toggle Explain mode to see which rules matched and why.
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

