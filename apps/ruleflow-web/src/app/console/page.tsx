'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApprovalRequest, ConfigStatus, ConsoleSnapshot, JsonDiffItem, RiskLevel } from '@/lib/demo/types';
import { apiGet, apiPost, downloadFromApi } from '@/lib/demo/api-client';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClassName } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { AuditItem } from '@/components/console/audit-item';
import { MetricCard } from '@/components/console/metric-card';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';
import styles from './console.module.css';

const statusVariant: Record<ConfigStatus, 'default' | 'success' | 'warning' | 'muted'> = {
  DRAFT: 'muted',
  REVIEW: 'warning',
  APPROVED: 'default',
  ACTIVE: 'success',
  DEPRECATED: 'muted',
  RETIRED: 'muted',
};

type DiffResponse =
  | { ok: false; error: string }
  | {
      ok: true;
      before: { id: string; version: string };
      after: { id: string; version: string };
      diffs: JsonDiffItem[];
      semantic?: { uiChanged: boolean; flowChanged: boolean; rulesChanged: boolean; apiChanged: boolean };
    };

type FeatureFlag = {
  id: string;
  env: string;
  key: string;
  enabled: boolean;
};

type KillSwitch = {
  id: string;
  scope: 'TENANT' | 'RULESET' | 'VERSION';
  packageId?: string;
  versionId?: string;
  active: boolean;
  reason?: string;
};

type ParsedPrometheusMetrics = {
  apiCalls: number;
  errors: number;
  ruleEvaluations: number;
  ruleMatches: number;
  flowTransitions: number;
  apiLatencyP95Ms: number | null;
  apiLatencyAvgMs: number | null;
};

const OBSERVABILITY_PROMQL_EXAMPLES = [
  'rate(api_call_count[5m])',
  'histogram_quantile(0.95, sum by (le) (rate(api_latency_ms_bucket[5m])))',
  'sum(rate(error_count[5m]))',
];

function parsePrometheusMetrics(text: string): ParsedPrometheusMetrics {
  const lines = text.split('\n');

  let apiCalls = 0;
  let errors = 0;
  let ruleEvaluations = 0;
  let ruleMatches = 0;
  let flowTransitions = 0;
  let apiLatencySum = 0;
  let apiLatencyCount = 0;

  const apiLatencyBuckets = new Map<string, number>();
  let apiLatencyTotalCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.exec(line);
    if (!match) continue;

    const name = match[1];
    const labels = parsePrometheusLabelString(match[3] ?? '');
    const value = Number(match[4]);
    if (!Number.isFinite(value)) continue;

    if (name === 'api_call_count') apiCalls += value;
    if (name === 'error_count') errors += value;
    if (name === 'rule_eval_count') ruleEvaluations += value;
    if (name === 'rule_match_count') ruleMatches += value;
    if (name === 'flow_transitions_count') flowTransitions += value;
    if (name === 'api_latency_ms_sum') apiLatencySum += value;
    if (name === 'api_latency_ms_count') apiLatencyCount += value;

    if (name === 'api_latency_ms_bucket') {
      const le = labels.le;
      if (le === '+Inf') {
        apiLatencyTotalCount += value;
      } else if (le) {
        const current = apiLatencyBuckets.get(le) ?? 0;
        apiLatencyBuckets.set(le, current + value);
      }
    }
  }

  let apiLatencyP95Ms: number | null = null;
  if (apiLatencyTotalCount > 0 && apiLatencyBuckets.size > 0) {
    const target = apiLatencyTotalCount * 0.95;
    const sortedBuckets = [...apiLatencyBuckets.entries()]
      .map(([le, value]) => ({ le: Number(le), value }))
      .filter((item) => Number.isFinite(item.le))
      .sort((left, right) => left.le - right.le);
    for (const bucket of sortedBuckets) {
      if (bucket.value >= target) {
        apiLatencyP95Ms = bucket.le;
        break;
      }
    }
  }

  return {
    apiCalls,
    errors,
    ruleEvaluations,
    ruleMatches,
    flowTransitions,
    apiLatencyP95Ms,
    apiLatencyAvgMs: apiLatencyCount > 0 ? apiLatencySum / apiLatencyCount : null,
  };
}

function parsePrometheusLabelString(input: string): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!input) return labels;
  const matcher = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g;
  let match = matcher.exec(input);
  while (match) {
    const key = match[1];
    if (!key) {
      match = matcher.exec(input);
      continue;
    }
    const value = match[2]?.replace(/\\"/g, '"').replace(/\\\\/g, '\\') ?? '';
    labels[key] = value;
    match = matcher.exec(input);
  }
  return labels;
}

function formatMetricNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatMetricMs(value: number | null): string {
  if (value === null) return '-';
  return `${formatMetricNumber(value)} ms`;
}

export default function ConsolePage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const showGovernance = tab === 'governance' || !tab;
  const showObservability = tab === 'observability' || !tab;
  const showVersions = tab === 'versions' || !tab;
  const { toast } = useToast();
  const { completeStep } = useOnboarding();

  const [snapshot, setSnapshot] = useState<ConsoleSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [diffOpen, setDiffOpen] = useState(false);
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewVersionId, setReviewVersionId] = useState<string | null>(null);
  const [reviewScope, setReviewScope] = useState('Tenant: Horizon Bank');
  const [reviewRisk, setReviewRisk] = useState<RiskLevel>('Medium');

  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestChangesApprovalId, setRequestChangesApprovalId] = useState<string | null>(null);
  const [requestChangesNotes, setRequestChangesNotes] = useState('');
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [killSwitches, setKillSwitches] = useState<KillSwitch[]>([]);
  const [executionTraces, setExecutionTraces] = useState<Array<{ id: string; executionId: string; correlationId: string; createdAt: string }>>([]);
  const [metricsText, setMetricsText] = useState('');
  const [sessionRoles, setSessionRoles] = useState<string[]>([]);
  const [newFlagEnv, setNewFlagEnv] = useState('prod');
  const [newFlagKey, setNewFlagKey] = useState('rules.explainMode');
  const [newFlagEnabled, setNewFlagEnabled] = useState(true);
  const [killScope, setKillScope] = useState<'TENANT' | 'RULESET' | 'VERSION'>('TENANT');
  const [killVersionId, setKillVersionId] = useState('');
  const [killReason, setKillReason] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await apiGet<ConsoleSnapshot>('/api/console');
      setSnapshot(data);
      const [flagsResp, killsResp] = await Promise.all([
        apiGet<{ ok: true; flags: FeatureFlag[] }>('/api/feature-flags').catch(() => ({ ok: true as const, flags: [] })),
        apiGet<{ ok: true; killSwitches: KillSwitch[] }>('/api/kill-switches').catch(() => ({ ok: true as const, killSwitches: [] })),
      ]);
      setFeatureFlags(flagsResp.flags ?? []);
      setKillSwitches(killsResp.killSwitches ?? []);
      const traceResp = await apiGet<{ ok: true; traces: Array<{ id: string; executionId: string; correlationId: string; createdAt: string }> }>(
        '/api/execution-traces?limit=50',
      ).catch(() => ({ ok: true as const, traces: [] }));
      setExecutionTraces(traceResp.traces ?? []);
      const metricsResp = await fetch('/api/metrics').then((response) => response.text()).catch(() => '');
      setMetricsText(metricsResp);
      const sessionResp = await apiGet<{ ok: true; session: { roles: string[] } }>('/api/session').catch(
        () => ({ ok: true as const, session: { roles: [] } }),
      );
      setSessionRoles(sessionResp.session.roles ?? []);
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to load console data',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const packageNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const pkg of snapshot?.packages ?? []) {
      map.set(pkg.id, pkg.name);
    }
    return map;
  }, [snapshot?.packages]);

  const statusCounts = useMemo(() => {
    const counts: Record<ConfigStatus, number> = {
      DRAFT: 0,
      REVIEW: 0,
      APPROVED: 0,
      ACTIVE: 0,
      DEPRECATED: 0,
      RETIRED: 0,
    };
    for (const v of snapshot?.versions ?? []) {
      counts[v.status] = (counts[v.status] ?? 0) + 1;
    }
    return counts;
  }, [snapshot?.versions]);

  const openDiff = async (versionId: string) => {
    setBusyKey(`diff:${versionId}`);
    try {
      const result = await apiGet<DiffResponse>(`/api/config-versions/${encodeURIComponent(versionId)}/diff`);
      setDiffData(result);
      setDiffOpen(true);
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Diff failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const promote = async (versionId: string) => {
    setBusyKey(`promote:${versionId}`);
    try {
      await apiPost(`/api/config-versions/${encodeURIComponent(versionId)}/promote`);
      toast({ variant: 'success', title: 'Promoted version to ACTIVE' });
      await refresh();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Promote failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const rollback = async (versionId: string) => {
    setBusyKey(`rollback:${versionId}`);
    try {
      await apiPost(`/api/config-versions/${encodeURIComponent(versionId)}/rollback`);
      toast({ variant: 'success', title: 'Rolled back ACTIVE version' });
      await refresh();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Rollback failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const createVersion = async (packageId: string, fromVersionId?: string) => {
    setBusyKey(`new-version:${packageId}`);
    try {
      const result = await apiPost<{ ok: true; versionId: string }>(
        `/api/config-packages/${encodeURIComponent(packageId)}/versions`,
        { fromVersionId },
      );
      toast({ variant: 'success', title: `Created new DRAFT version (${result.versionId})` });
      await refresh();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Create version failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const submitReview = async () => {
    if (!reviewVersionId) return;
    setBusyKey(`review:${reviewVersionId}`);
    try {
      await apiPost(`/api/config-versions/${encodeURIComponent(reviewVersionId)}/submit-review`, {
        scope: reviewScope,
        risk: reviewRisk,
      });
      toast({ variant: 'success', title: 'Submitted for review' });
      setReviewOpen(false);
      setReviewVersionId(null);
      await refresh();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Submit for review failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const approve = async (approvalId: string) => {
    setBusyKey(`approve:${approvalId}`);
    try {
      await apiPost(`/api/approvals/${encodeURIComponent(approvalId)}/approve`);
      toast({ variant: 'success', title: 'Approved' });
      await refresh();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Approval failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const doRequestChanges = async () => {
    if (!requestChangesApprovalId) return;
    setBusyKey(`changes:${requestChangesApprovalId}`);
    try {
      await apiPost(`/api/approvals/${encodeURIComponent(requestChangesApprovalId)}/request-changes`, {
        notes: requestChangesNotes.trim() || undefined,
      });
      toast({ variant: 'success', title: 'Requested changes' });
      setRequestChangesOpen(false);
      setRequestChangesApprovalId(null);
      setRequestChangesNotes('');
      await refresh();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Request changes failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const exportGitOps = async () => {
    setBusyKey('gitops:export');
    try {
      await downloadFromApi('/api/gitops/export', 'ruleflow-gitops.json');
      toast({ variant: 'success', title: 'Exported GitOps bundle' });
      completeStep('exportGitOps');
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Export failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const saveFeatureFlag = async () => {
    setBusyKey('flags:save');
    try {
      await apiPost('/api/feature-flags', {
        env: newFlagEnv.trim(),
        key: newFlagKey.trim(),
        enabled: newFlagEnabled,
        value: {},
      });
      toast({ variant: 'success', title: 'Feature flag updated' });
      await refresh();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Feature flag update failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const saveKillSwitch = async () => {
    setBusyKey('kill:save');
    try {
      await apiPost('/api/kill-switches', {
        scope: killScope,
        active: true,
        versionId: killScope === 'VERSION' ? killVersionId.trim() : undefined,
        reason: killReason.trim() || undefined,
      });
      toast({ variant: 'success', title: 'Kill switch updated' });
      await refresh();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Kill switch update failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const importGitOps = async (file: File) => {
    setBusyKey('gitops:import');
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/gitops/import', { method: 'POST', body: form });
      if (!response.ok) {
        const raw = await response.text();
        let message = raw;
        try {
          const parsed = JSON.parse(raw) as { error?: unknown };
          if (typeof parsed.error === 'string') {
            message = parsed.error;
          }
        } catch {
          // fall back to plain text payload
        }
        if (response.status >= 500 && !message.includes('Persistence unavailable, check store provider')) {
          message = `${message || `${response.status} ${response.statusText}`}. Persistence unavailable, check store provider`;
        }
        throw new Error(message || `${response.status} ${response.statusText}`);
      }
      toast({ variant: 'success', title: 'Imported GitOps bundle' });
      await refresh();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Import failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const versions = snapshot?.versions ?? [];
  const approvals = (snapshot?.approvals ?? []).filter((a) => a.status === 'PENDING');
  const audit = snapshot?.audit ?? [];
  const canAuthor = sessionRoles.includes('Author');
  const canApprove = sessionRoles.includes('Approver');
  const canPublish = sessionRoles.includes('Publisher');
  const topMetrics = useMemo(() => parsePrometheusMetrics(metricsText), [metricsText]);

  return (
    <div className={styles.page}>
      {loading ? (
        <Card>
          <CardContent>
            <p className={styles.loadingText}>Loading console data...</p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && snapshot && (showGovernance || showObservability) ? (
        <section className={styles.grid3}>
          <Card>
            <CardHeader>
              <CardTitle>Config Lifecycle</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={styles.muted}>
                {statusCounts.ACTIVE} active - {statusCounts.REVIEW} in review - {statusCounts.DRAFT} drafts
              </p>
              <div className={styles.badgeRow}>
                {(Object.keys(statusCounts) as ConfigStatus[]).map((status) => (
                  <Badge
                    key={status}
                    variant={status === 'ACTIVE' ? 'success' : status === 'REVIEW' ? 'warning' : 'muted'}
                  >
                    {status} {statusCounts[status] ? `(${statusCounts[status]})` : ''}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <MetricCard title="Governance SLA" value="4h 22m" caption="Average approval time" detail={`Approvals pending: ${approvals.length}`} />
          <MetricCard title="Audit Coverage" value="100%" caption="Traceability across tenants" detail={`Events: ${audit.length}`} />
        </section>
      ) : null}

      {!loading && snapshot && (showVersions || showGovernance) ? (
        <section className={styles.gridMain}>
          {showVersions ? (
            <Card>
              <CardHeader>
                <div className={styles.cardHeaderRow}>
                  <CardTitle>Version Management</CardTitle>
                  <Button variant="outline" size="sm" onClick={refresh} disabled={busyKey !== null}>
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className={styles.stack}>
                  {versions.map((version) => {
                    const pkgName = packageNameById.get(version.packageId) ?? version.packageId;
                    const isKilled = Boolean(version.isKilled);
                    const canPromote = version.status === 'APPROVED' && canPublish && !isKilled;
                    const canSubmitReview = version.status === 'DRAFT' && canAuthor;
                    return (
                      <div key={version.id} data-testid={`version-row-${version.id}`} className={styles.versionRow}>
                        <div className={styles.versionTop}>
                          <div className={styles.versionTitleWrap}>
                            <p className={styles.pkgName}>{pkgName}</p>
                            <p className={styles.pkgMeta}>
                              {version.version} - {version.createdBy}
                            </p>
                          </div>
                          <div className={styles.actionsRow}>
                            <Badge variant={statusVariant[version.status]}>{version.status}</Badge>
                            {isKilled ? <Badge variant="warning">KILLED</Badge> : null}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDiff(version.id)}
                              disabled={busyKey === `diff:${version.id}`}
                            >
                              {busyKey === `diff:${version.id}` ? 'Diff...' : 'Diff'}
                            </Button>
                            <Link
                              className={buttonClassName({ variant: 'outline', size: 'sm' })}
                              href={`/builder?versionId=${encodeURIComponent(version.id)}`}
                            >
                              Edit
                            </Link>
                            <Button
                              size="sm"
                              onClick={() => promote(version.id)}
                              disabled={!canPromote || busyKey === `promote:${version.id}`}
                              title={
                                canPromote
                                  ? undefined
                                  : isKilled
                                    ? version.killReason ?? 'Kill switch is active for this version'
                                    : `Cannot promote a ${version.status} version`
                              }
                            >
                              {busyKey === `promote:${version.id}` ? 'Promoting...' : 'Promote'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rollback(version.id)}
                              disabled={!canPublish || busyKey === `rollback:${version.id}`}
                            >
                              {busyKey === `rollback:${version.id}` ? 'Rolling back...' : 'Rollback'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => createVersion(version.packageId, version.id)}
                              disabled={!canAuthor || busyKey === `new-version:${version.packageId}`}
                            >
                              {busyKey === `new-version:${version.packageId}` ? 'Creating...' : 'New Version'}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setReviewVersionId(version.id);
                                setReviewOpen(true);
                              }}
                              disabled={!canSubmitReview}
                              title={canSubmitReview ? undefined : `Submit is only available for DRAFT versions`}
                            >
                              Submit
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {versions.length === 0 ? <p className={styles.muted}>No versions found.</p> : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {showGovernance ? (
            <Card>
              <CardHeader>
                <CardTitle>Approval Queue</CardTitle>
              </CardHeader>
              <CardContent className={styles.stack}>
                {approvals.map((item) => (
                  <ApprovalRow
                    key={item.id}
                    item={item}
                    packageName={packageNameById.get(item.packageId)}
                    busyKey={busyKey}
                    onApprove={() => approve(item.id)}
                    canApprove={canApprove}
                    onRequestChanges={() => {
                      setRequestChangesApprovalId(item.id);
                      setRequestChangesOpen(true);
                      setRequestChangesNotes('');
                    }}
                  />
                ))}
                {approvals.length === 0 ? <p className={styles.muted}>No pending approvals.</p> : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
            </CardHeader>
            <CardContent className={styles.stack}>
              <div className={styles.formGrid}>
                <div>
                  <label className="rfFieldLabel">Env</label>
                  <Input value={newFlagEnv} onChange={(event) => setNewFlagEnv(event.target.value)} />
                </div>
                <div>
                  <label className="rfFieldLabel">Key</label>
                  <Input value={newFlagKey} onChange={(event) => setNewFlagKey(event.target.value)} />
                </div>
                <div>
                  <label className="rfFieldLabel">Enabled</label>
                  <Select
                    value={newFlagEnabled ? 'true' : 'false'}
                    onChange={(event) => setNewFlagEnabled(event.target.value === 'true')}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </Select>
                </div>
              </div>
              <div>
                <Button size="sm" onClick={saveFeatureFlag} disabled={!canPublish || busyKey === 'flags:save'}>
                  {busyKey === 'flags:save' ? 'Saving...' : 'Save Flag'}
                </Button>
              </div>
              <div className={styles.stack}>
                {featureFlags.map((flag) => (
                  <div key={flag.id} className={styles.approvalRow}>
                    <p className={styles.approvalMeta}>
                      {flag.env}:{flag.key}
                    </p>
                    <Badge variant={flag.enabled ? 'success' : 'muted'}>{String(flag.enabled)}</Badge>
                  </div>
                ))}
                {featureFlags.length === 0 ? <p className={styles.muted}>No feature flags.</p> : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kill Switch</CardTitle>
            </CardHeader>
            <CardContent className={styles.stack}>
              <div className={styles.formGrid}>
                <div>
                  <label className="rfFieldLabel">Scope</label>
                  <Select value={killScope} onChange={(event) => setKillScope(event.target.value as 'TENANT' | 'RULESET' | 'VERSION')}>
                    <option value="TENANT">TENANT</option>
                    <option value="RULESET">RULESET</option>
                    <option value="VERSION">VERSION</option>
                  </Select>
                </div>
                <div>
                  <label className="rfFieldLabel">Version Id (optional)</label>
                  <Input value={killVersionId} onChange={(event) => setKillVersionId(event.target.value)} />
                </div>
                <div>
                  <label className="rfFieldLabel">Reason</label>
                  <Input value={killReason} onChange={(event) => setKillReason(event.target.value)} />
                </div>
              </div>
              <div>
                <Button size="sm" onClick={saveKillSwitch} disabled={!canPublish || busyKey === 'kill:save'}>
                  {busyKey === 'kill:save' ? 'Saving...' : 'Activate Kill Switch'}
                </Button>
              </div>
              <div className={styles.stack}>
                {killSwitches.map((kill) => (
                  <div key={kill.id} className={styles.approvalRow}>
                    <p className={styles.approvalMeta}>
                      {kill.scope} {kill.versionId ? `(${kill.versionId})` : ''}
                    </p>
                    <Badge variant={kill.active ? 'warning' : 'muted'}>{kill.active ? 'active' : 'inactive'}</Badge>
                  </div>
                ))}
                {killSwitches.length === 0 ? <p className={styles.muted}>No kill switches.</p> : null}
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {!loading && snapshot && (showObservability || showVersions) ? (
        <section className={styles.grid2}>
          {showObservability ? (
            <Card>
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
              </CardHeader>
              <CardContent className={styles.stack}>
                {audit.map((event) => (
                  <AuditItem
                    key={event.id}
                    action={event.action}
                    actor={event.actor}
                    target={event.target}
                    time={new Date(event.at).toLocaleString()}
                    severity={event.severity === 'warning' ? 'warning' : 'info'}
                  />
                ))}
                {audit.length === 0 ? <p className={styles.muted}>No audit events yet.</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {showObservability ? (
            <Card>
              <CardHeader>
                <CardTitle>Top Metrics</CardTitle>
              </CardHeader>
              <CardContent className={styles.metricsWidgetGrid}>
                <div className={styles.metricWidget}>
                  <p className={styles.metricWidgetLabel}>API Calls</p>
                  <p className={styles.metricWidgetValue}>{formatMetricNumber(topMetrics.apiCalls)}</p>
                </div>
                <div className={styles.metricWidget}>
                  <p className={styles.metricWidgetLabel}>Errors</p>
                  <p className={styles.metricWidgetValue}>{formatMetricNumber(topMetrics.errors)}</p>
                </div>
                <div className={styles.metricWidget}>
                  <p className={styles.metricWidgetLabel}>API Latency P95</p>
                  <p className={styles.metricWidgetValue}>{formatMetricMs(topMetrics.apiLatencyP95Ms)}</p>
                </div>
                <div className={styles.metricWidget}>
                  <p className={styles.metricWidgetLabel}>API Latency Avg</p>
                  <p className={styles.metricWidgetValue}>{formatMetricMs(topMetrics.apiLatencyAvgMs)}</p>
                </div>
                <div className={styles.metricWidget}>
                  <p className={styles.metricWidgetLabel}>Rule Evaluations</p>
                  <p className={styles.metricWidgetValue}>{formatMetricNumber(topMetrics.ruleEvaluations)}</p>
                </div>
                <div className={styles.metricWidget}>
                  <p className={styles.metricWidgetLabel}>Rule Matches</p>
                  <p className={styles.metricWidgetValue}>{formatMetricNumber(topMetrics.ruleMatches)}</p>
                </div>
                <div className={styles.metricWidget}>
                  <p className={styles.metricWidgetLabel}>Flow Transitions</p>
                  <p className={styles.metricWidgetValue}>{formatMetricNumber(topMetrics.flowTransitions)}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {showObservability ? (
            <Card>
              <CardHeader>
                <CardTitle>Prometheus Metrics</CardTitle>
              </CardHeader>
              <CardContent className={styles.stack}>
                <div className={styles.promqlStack}>
                  {OBSERVABILITY_PROMQL_EXAMPLES.map((query) => (
                    <code key={query} className={styles.promqlCode}>
                      {query}
                    </code>
                  ))}
                </div>
                <details>
                  <summary className={styles.metricsSummary}>Raw exposition</summary>
                  <pre className={styles.diffPre}>{metricsText || '# metrics unavailable'}</pre>
                </details>
              </CardContent>
            </Card>
          ) : null}

          {showObservability ? (
            <Card>
              <CardHeader>
                <CardTitle>Execution Traces</CardTitle>
              </CardHeader>
              <CardContent className={styles.stack}>
                {executionTraces.map((trace) => (
                  <div key={trace.id} className={styles.approvalRow}>
                    <p className={styles.approvalMeta}>executionId: {trace.executionId}</p>
                    <p className={styles.approvalMeta}>correlationId: {trace.correlationId}</p>
                    <p className={styles.approvalMeta}>{new Date(trace.createdAt).toLocaleString()}</p>
                  </div>
                ))}
                {executionTraces.length === 0 ? <p className={styles.muted}>No execution traces captured yet.</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {showVersions ? (
            <Card>
              <CardHeader>
                <CardTitle>GitOps Package</CardTitle>
              </CardHeader>
              <CardContent className={styles.gitopsContent}>
                <p>Export/import the full local config registry as a GitOps JSON bundle.</p>
                <div className={styles.gitopsActions}>
                  <Button size="sm" onClick={exportGitOps} disabled={busyKey === 'gitops:export'}>
                    {busyKey === 'gitops:export' ? 'Exporting...' : 'Export'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busyKey === 'gitops:import'}
                  >
                    {busyKey === 'gitops:import' ? 'Importing...' : 'Import'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    className="rfVisuallyHidden"
                    type="file"
                    accept="application/json"
                    aria-label="Import GitOps package JSON"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importGitOps(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </div>
                <div className={styles.gitopsPathBox}>
                  gitops://tenant/{snapshot.tenantId}/packages ({snapshot.packages.length})
                </div>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      <Modal
        open={reviewOpen}
        title="Submit For Review"
        description="Create an approval request and move this version into REVIEW."
        onClose={() => (busyKey ? null : setReviewOpen(false))}
        footer={
          <div className={styles.modalFooter}>
            <Button type="button" variant="outline" onClick={() => setReviewOpen(false)} disabled={busyKey !== null}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitReview}
              disabled={!canAuthor || !reviewVersionId || busyKey !== null || reviewScope.trim().length === 0}
            >
              Submit
            </Button>
          </div>
        }
      >
        <div className={styles.formGrid}>
          <div>
            <label className="rfFieldLabel">Scope</label>
            <Input value={reviewScope} onChange={(e) => setReviewScope(e.target.value)} placeholder="Tenant: Horizon Bank" />
          </div>
          <div>
            <label className="rfFieldLabel">Risk</label>
            <Select value={reviewRisk} onChange={(e) => setReviewRisk(e.target.value as RiskLevel)}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </Select>
          </div>
        </div>
      </Modal>

      <Modal
        open={requestChangesOpen}
        title="Request Changes"
        description="Send this version back to DRAFT with reviewer notes."
        onClose={() => (busyKey ? null : setRequestChangesOpen(false))}
        footer={
          <div className={styles.modalFooter}>
            <Button type="button" variant="outline" onClick={() => setRequestChangesOpen(false)} disabled={busyKey !== null}>
              Cancel
            </Button>
            <Button type="button" onClick={doRequestChanges} disabled={!canApprove || !requestChangesApprovalId || busyKey !== null}>
              Request changes
            </Button>
          </div>
        }
      >
        <div className={styles.formStackSm}>
          <label className="rfFieldLabel">Notes</label>
          <Textarea
            value={requestChangesNotes}
            onChange={(e) => setRequestChangesNotes(e.target.value)}
            placeholder="What needs to change before approval?"
          />
        </div>
      </Modal>

      <Modal
        open={diffOpen}
        size="lg"
        title="Bundle Diff"
        description="Deep diff of the config bundle (UI, flow, rules, API)."
        onClose={() => setDiffOpen(false)}
        footer={
          <div className={styles.modalFooter}>
            <Button type="button" variant="outline" onClick={() => setDiffOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {!diffData ? (
          <p className={styles.muted}>Loading diff...</p>
        ) : diffData.ok === false ? (
          <p className={styles.errorText}>{diffData.error}</p>
        ) : (
          <div className={styles.stack}>
            <p className={styles.diffTopText}>
              Comparing <strong>{diffData.before.version}</strong> -&gt; <strong>{diffData.after.version}</strong> (
              {diffData.diffs.length} changes)
            </p>
            {diffData.semantic ? (
              <p className={styles.muted}>
                Semantic: UI {diffData.semantic.uiChanged ? 'changed' : 'unchanged'} | Flow{' '}
                {diffData.semantic.flowChanged ? 'changed' : 'unchanged'} | Rules{' '}
                {diffData.semantic.rulesChanged ? 'changed' : 'unchanged'} | API{' '}
                {diffData.semantic.apiChanged ? 'changed' : 'unchanged'}
              </p>
            ) : null}
            <div className={styles.diffScroll}>
              <ul className={styles.diffList}>
                {diffData.diffs.slice(0, 200).map((d) => (
                  <li key={d.path} className={styles.diffItem}>
                    <div className={styles.diffPathRow}>{d.path}</div>
                    <div className={styles.diffPanel}>
                      <p className={styles.diffPanelTitle}>Before</p>
                      <pre className={styles.diffPre}>{JSON.stringify(d.before, null, 2)}</pre>
                    </div>
                    <div className={styles.diffPanel}>
                      <p className={styles.diffPanelTitle}>After</p>
                      <pre className={styles.diffPre}>{JSON.stringify(d.after, null, 2)}</pre>
                    </div>
                  </li>
                ))}
              </ul>
              {diffData.diffs.length > 200 ? <p className={styles.muted}>Showing first 200 changes.</p> : null}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ApprovalRow({
  item,
  packageName,
  busyKey,
  onApprove,
  canApprove,
  onRequestChanges,
}: {
  item: ApprovalRequest;
  packageName?: string;
  busyKey: string | null;
  onApprove: () => void;
  canApprove: boolean;
  onRequestChanges: () => void;
}) {
  const approving = busyKey === `approve:${item.id}`;
  return (
    <div data-testid={`approval-row-${item.id}`} className={styles.approvalRow}>
      <div className={styles.approvalTop}>
        <span className={styles.approvalName}>{packageName ?? item.packageId}</span>
        <Badge variant={item.risk === 'Medium' ? 'warning' : item.risk === 'High' ? 'warning' : 'muted'}>{item.risk}</Badge>
      </div>
      <p className={styles.approvalMeta}>Requested by {item.requestedBy}</p>
      <p className={styles.approvalMeta}>{item.scope}</p>
      <div className={styles.approvalActions}>
        <Button size="sm" onClick={onApprove} disabled={!canApprove || approving}>
          {approving ? 'Approving...' : 'Approve'}
        </Button>
        <Button variant="outline" size="sm" onClick={onRequestChanges} disabled={!canApprove || busyKey !== null}>
          Request changes
        </Button>
      </div>
    </div>
  );
}
