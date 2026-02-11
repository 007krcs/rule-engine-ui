'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ComponentDefinition, ComponentRegistryManifest, RegistryValidationIssue } from '@platform/component-registry';
import { builtinComponentDefinitions } from '@platform/component-registry';
import { apiGet, apiPost } from '@/lib/demo/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import styles from './registry.module.css';

type RegistrySnapshotResponse =
  | { ok: true; tenantId: string; global: ComponentDefinition[]; tenant: ComponentDefinition[]; effective: ComponentDefinition[] }
  | { ok: false; error: string };

type RegisterResponse =
  | { ok: true; count: number }
  | { ok: false; error: string; issues?: RegistryValidationIssue[] };

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default function ComponentRegistryPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<RegistrySnapshotResponse | null>(null);

  const [scope, setScope] = useState<'tenant' | 'global'>('tenant');
  const [tenantId, setTenantId] = useState('tenant-1');
  const [manifestText, setManifestText] = useState<string>(() =>
    JSON.stringify({ schemaVersion: 1, components: builtinComponentDefinitions().slice(0, 2) }, null, 2),
  );
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<RegistryValidationIssue[] | null>(null);

  const parsed = useMemo(() => safeJsonParse(manifestText), [manifestText]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await apiGet<RegistrySnapshotResponse>('/api/component-registry');
      setSnapshot(data);
      if (data && typeof data === 'object' && 'ok' in data && data.ok) {
        setTenantId(data.tenantId);
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load registry', description: error instanceof Error ? error.message : String(error) });
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const register = async () => {
    setIssues(null);
    if (!parsed.ok) {
      toast({ variant: 'error', title: 'Invalid JSON', description: parsed.error });
      return;
    }

    setBusy(true);
    try {
      const result = await apiPost<RegisterResponse>('/api/component-registry', {
        scope,
        tenantId: scope === 'tenant' ? tenantId.trim() : undefined,
        manifest: parsed.value as ComponentRegistryManifest,
      });
      if (!result.ok) {
        setIssues(result.issues ?? null);
        throw new Error(result.error);
      }
      toast({ variant: 'success', title: 'Registered manifest', description: `${result.count} component(s)` });
      await refresh();
    } catch (error) {
      toast({ variant: 'error', title: 'Register failed', description: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const effective = snapshot && typeof snapshot === 'object' && 'ok' in snapshot && snapshot.ok ? snapshot.effective : [];

  const grouped = useMemo(() => {
    const map = new Map<string, ComponentDefinition[]>();
    for (const item of effective) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [effective]);

  return (
    <div className={styles.page}>
      <Card>
        <CardHeader>
          <CardTitle>Component Registry</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rfHelperText" style={{ marginTop: 0 }}>
            Register component manifests so Builder can auto-generate property forms from JSON Schema and keep the platform pluggable.
          </p>
        </CardContent>
      </Card>

      <div className={styles.grid2}>
        <Card>
          <CardHeader>
            <CardTitle>Available Components</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="rfHelperText">Loading registry...</p> : null}
            {!loading && grouped.length === 0 ? <p className="rfHelperText">No components registered.</p> : null}

            <div className={styles.list}>
              {grouped.map(([category, items]) => (
                <section key={category}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong>{category}</strong>
                    <Badge variant="muted">{items.length}</Badge>
                  </div>
                  <div className={styles.list}>
                    {items.map((item) => (
                      <div key={item.adapterHint} className={styles.componentRow}>
                        <div className={styles.rowTop}>
                          <span className={styles.rowName}>{item.displayName}</span>
                          <span className={styles.rowHint}>{item.adapterHint}</span>
                        </div>
                        {item.propsSchema?.description ? <p className={styles.rowDesc}>{item.propsSchema.description}</p> : null}
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 12 }} />
                </section>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Component Onboarding</CardTitle>
          </CardHeader>
          <CardContent style={{ display: 'grid', gap: 12 }}>
            <div className={styles.field}>
              <label className="rfFieldLabel">Scope</label>
              <Select value={scope} onChange={(e) => setScope(e.target.value as 'tenant' | 'global')} disabled={busy}>
                <option value="tenant">Tenant</option>
                <option value="global">Global</option>
              </Select>
              <p className="rfHelperText" style={{ marginTop: 6 }}>
                Tenant-scoped manifests override global definitions for the active tenant.
              </p>
            </div>

            <div className={styles.field}>
              <label className="rfFieldLabel">Tenant Id</label>
              <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} disabled={busy || scope !== 'tenant'} />
            </div>

            <div className={styles.field}>
              <label className="rfFieldLabel">Manifest JSON</label>
              <Textarea
                className={styles.textarea}
                value={manifestText}
                onChange={(e) => setManifestText(e.target.value)}
                disabled={busy}
              />
              {!parsed.ok ? <p className="rfHelperText">JSON error: {parsed.error}</p> : null}
            </div>

            {issues && issues.length > 0 ? (
              <div className={styles.issues} role="status" aria-live="polite">
                {issues.slice(0, 8).map((issue) => (
                  <p key={`${issue.path}-${issue.message}`} style={{ margin: 0 }}>
                    <span className={styles.issuePath}>{issue.path}</span>: {issue.message}
                  </p>
                ))}
                {issues.length > 8 ? <p style={{ margin: 0 }}>...</p> : null}
              </div>
            ) : null}

            <div className={styles.actionsRow}>
              <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
                Refresh
              </Button>
              <Button size="sm" onClick={() => void register()} disabled={busy || !parsed.ok}>
                {busy ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

