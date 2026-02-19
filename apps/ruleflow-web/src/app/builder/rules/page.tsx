'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { RuleSet } from '@platform/schema';
import { validateRulesSchema } from '@platform/validator';
import type { ConfigVersion } from '@/lib/demo/types';
import { apiGet, apiPatch } from '@/lib/demo/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';
import { RuleListPanel } from '@/components/rules/RuleListPanel';
import { RuleEditorPanel } from '@/components/rules/RuleEditorPanel';
import { ExplainPreviewPanel } from '@/components/rules/ExplainPreviewPanel';
import {
  cloneRuleDraft,
  createDefaultRuleDraft,
  draftsToRuleSet,
  type RuleDraft,
  rulesToDrafts,
} from '@/components/rules/rule-visual-model';
import { useBuilder } from '@/context/BuilderContext';
import styles from './rules.module.scss';

type GetVersionResponse = { ok: true; version: ConfigVersion } | { ok: false; error: string };

function nextRuleId(existing: Set<string>, base: string): string {
  const cleaned = base.trim() || 'RULE';
  if (!existing.has(cleaned)) return cleaned;
  let n = 2;
  while (existing.has(`${cleaned}_${n}`)) n += 1;
  return `${cleaned}_${n}`;
}

function reorderByIds<T extends { id: string }>(items: T[], fromId: string, toId: string): T[] {
  const fromIndex = items.findIndex((item) => item.id === fromId);
  const toIndex = items.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return items;
  next.splice(toIndex, 0, moved);
  return next;
}

export default function RulesBuilderPage() {
  const searchParams = useSearchParams();
  const versionId = searchParams.get('versionId');
  const { toast } = useToast();
  const onboarding = useOnboarding();
  const {
    state: { rules },
    dispatch,
  } = useBuilder();

  const [loading, setLoading] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState<ConfigVersion | null>(null);
  const [selectedRuleDraftId, setSelectedRuleDraftId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [dirty, setDirty] = useState(false);
  const lastLoadedVersionId = useRef<string | null>(null);

  const ruleDrafts = useMemo(() => rulesToDrafts(rules), [rules]);
  const ruleVersion = useMemo(
    () => loadedVersion?.bundle.rules.version ?? rules.version ?? '1.0.0',
    [loadedVersion?.bundle.rules.version, rules.version],
  );

  const selectedRule = useMemo(
    () => ruleDrafts.find((rule) => rule.id === selectedRuleDraftId) ?? null,
    [ruleDrafts, selectedRuleDraftId],
  );

  const compiledRuleSet = useMemo(() => {
    return draftsToRuleSet(ruleVersion, ruleDrafts);
  }, [ruleDrafts, ruleVersion]);

  const validation = useMemo(() => validateRulesSchema(compiledRuleSet), [compiledRuleSet]);

  const loadFromStore = async (force?: boolean) => {
    if (!versionId) return;
    if (!force && dirty) {
      toast({ variant: 'info', title: 'Unsaved changes', description: 'Save or use Reload to discard local edits.' });
      return;
    }

    setLoading(true);
    try {
      const response = await apiGet<GetVersionResponse>(`/api/config-versions/${encodeURIComponent(versionId)}`);
      if (!response.ok) throw new Error(response.error);
      const drafts = rulesToDrafts(response.version.bundle.rules);

      setLoadedVersion(response.version);
      dispatch({ type: 'SET_RULES', rules: response.version.bundle.rules });
      setSelectedRuleDraftId(drafts[0]?.id ?? null);
      setSearchText('');
      setDirty(false);
      lastLoadedVersionId.current = versionId;
      toast({ variant: 'info', title: 'Loaded rules', description: response.version.version });
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load rules', description: error instanceof Error ? error.message : String(error) });
      setLoadedVersion(null);
      dispatch({ type: 'SET_RULES', rules: { version: '1.0.0', rules: [] } });
      setSelectedRuleDraftId(null);
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

  useEffect(() => {
    if (selectedRuleDraftId && ruleDrafts.some((r) => r.id === selectedRuleDraftId)) return;
    setSelectedRuleDraftId(ruleDrafts[0]?.id ?? null);
  }, [ruleDrafts, selectedRuleDraftId]);

  const applyDrafts = (drafts: RuleDraft[], opts?: { dirty?: boolean; selectedId?: string | null }) => {
    const nextRuleSet = draftsToRuleSet(ruleVersion, drafts);
    dispatch({ type: 'SET_RULES', rules: nextRuleSet });
    if (opts && 'selectedId' in opts) {
      setSelectedRuleDraftId(opts.selectedId ?? null);
    } else if (drafts.length && !drafts.some((d) => d.id === selectedRuleDraftId)) {
      setSelectedRuleDraftId(drafts[0]?.id ?? null);
    }
    setDirty(opts?.dirty ?? true);
  };

  const updateRuleDraft = (rule: RuleDraft) => {
    const nextDrafts = ruleDrafts.map((candidate) => (candidate.id === rule.id ? rule : candidate));
    applyDrafts(nextDrafts);
  };

  const addRuleDraft = () => {
    const existing = new Set(ruleDrafts.map((rule) => rule.ruleId));
    const next = createDefaultRuleDraft();
    next.ruleId = nextRuleId(existing, next.ruleId);
    applyDrafts([next, ...ruleDrafts], { selectedId: next.id });
  };

  const duplicateRuleDraft = (ruleId: string) => {
    const source = ruleDrafts.find((rule) => rule.id === ruleId);
    if (!source) return;
    const existing = new Set(ruleDrafts.map((rule) => rule.ruleId));
    const duplicated = cloneRuleDraft(source);
    duplicated.ruleId = nextRuleId(existing, duplicated.ruleId);
    applyDrafts([duplicated, ...ruleDrafts], { selectedId: duplicated.id });
  };

  const deleteRuleDraft = (ruleId: string) => {
    const next = ruleDrafts.filter((rule) => rule.id !== ruleId);
    const nextSelected = selectedRuleDraftId === ruleId ? next[0]?.id ?? null : selectedRuleDraftId;
    applyDrafts(next, { selectedId: nextSelected });
  };

  const save = async () => {
    if (!versionId) {
      toast({ variant: 'error', title: 'No version selected', description: 'Open this page with ?versionId=...' });
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
        { rules: compiledRuleSet as RuleSet },
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
            <CardTitle>Start with a config version</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={styles.hintText}>
              Rules are saved per version. Open this page with <span className="rfCodeInline">?versionId=...</span> to begin.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className={styles.headerRow}>
            <div>
              <CardTitle>Visual Rules Editor</CardTitle>
              <p className={styles.subtext}>
                {versionId ? (
                  <>
                    Editing <span className="rfCodeInline">{versionId}</span>
                    {loadedVersion ? ` - ${loadedVersion.status}` : null}
                  </>
                ) : (
                  'Open with ?versionId=...'
                )}
              </p>
            </div>
            <div className={styles.actions}>
              <Button variant="outline" size="sm" onClick={() => void loadFromStore(true)} disabled={!versionId || loading}>
                Reload
              </Button>
              <Button
                size="sm"
                onClick={() => void save()}
                disabled={!versionId || loading || !validation.valid || !dirty}
                data-testid="rules-save-button"
              >
                {loading ? 'Working...' : 'Save'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={styles.validationBar}>
          <p className={styles.validationText}>
            {validation.valid ? `Valid ruleset (${compiledRuleSet.rules.length} rules)` : `${validation.issues.length} validation issue(s)`}
          </p>
          {!validation.valid ? (
            <div className={styles.issues}>
              {validation.issues.slice(0, 5).map((issue) => (
                <p key={`${issue.path}-${issue.message}`} className={styles.issueLine}>
                  <span className={styles.issuePath}>{issue.path || 'root'}</span>: {issue.message}
                </p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className={styles.workspace}>
        <Card className={styles.leftPane}>
          <CardContent className={styles.scrollPane}>
            <RuleListPanel
              rules={ruleDrafts}
              selectedRuleId={selectedRuleDraftId}
              searchText={searchText}
              onSearchTextChange={setSearchText}
              onSelectRule={setSelectedRuleDraftId}
              onAddRule={addRuleDraft}
              onDuplicateRule={duplicateRuleDraft}
              onDeleteRule={deleteRuleDraft}
              onReorderRules={(fromRuleId, toRuleId) => {
                applyDrafts(reorderByIds(ruleDrafts, fromRuleId, toRuleId));
              }}
            />
          </CardContent>
        </Card>

        <Card className={styles.centerPane}>
          <CardContent className={styles.scrollPane}>
            <RuleEditorPanel
              rule={selectedRule}
              onRuleChange={(nextRule) => {
                updateRuleDraft(nextRule);
                if (selectedRuleDraftId !== nextRule.id) setSelectedRuleDraftId(nextRule.id);
              }}
            />
          </CardContent>
        </Card>

        <Card className={styles.rightPane}>
          <CardContent className={styles.scrollPane}>
            <ExplainPreviewPanel ruleSet={compiledRuleSet} />

            <details className={styles.advancedJson}>
              <summary>Advanced JSON (read-only)</summary>
              <pre className={styles.jsonPreview} data-testid="rules-json-preview">
                {JSON.stringify(compiledRuleSet, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
