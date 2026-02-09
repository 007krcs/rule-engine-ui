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
  | { ok: true; before: { id: string; version: string }; after: { id: string; version: string }; diffs: JsonDiffItem[] };

export default function ConsolePage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const showGovernance = tab === 'governance' || !tab;
  const showObservability = tab === 'observability' || !tab;
  const showVersions = tab === 'versions' || !tab;
  const { toast } = useToast();

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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await apiGet<ConsoleSnapshot>('/api/console');
      setSnapshot(data);
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

  const importGitOps = async (file: File) => {
    setBusyKey('gitops:import');
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/gitops/import', { method: 'POST', body: form });
      if (!response.ok) {
        const message = await response.text();
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
                    const canPromote = version.status === 'APPROVED';
                    const canSubmitReview = version.status === 'DRAFT';
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
                              title={canPromote ? undefined : `Cannot promote a ${version.status} version`}
                            >
                              {busyKey === `promote:${version.id}` ? 'Promoting...' : 'Promote'}
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
              disabled={!reviewVersionId || busyKey !== null || reviewScope.trim().length === 0}
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
            <Button type="button" onClick={doRequestChanges} disabled={!requestChangesApprovalId || busyKey !== null}>
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
  onRequestChanges,
}: {
  item: ApprovalRequest;
  packageName?: string;
  busyKey: string | null;
  onApprove: () => void;
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
        <Button size="sm" onClick={onApprove} disabled={approving}>
          {approving ? 'Approving...' : 'Approve'}
        </Button>
        <Button variant="outline" size="sm" onClick={onRequestChanges} disabled={busyKey !== null}>
          Request changes
        </Button>
      </div>
    </div>
  );
}
