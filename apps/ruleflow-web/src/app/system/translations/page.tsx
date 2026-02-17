'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '@/lib/demo/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import styles from './translations.module.scss';

type TranslationSnapshot =
  | {
      ok: true;
      locale: string;
      namespace: string;
      locales: string[];
      fallbackLocale: string;
      tenantLocale: string;
      userLocale: string;
      messages: Record<string, string>;
      missingKeys: string[];
      requiredKeys: string[];
    }
  | {
      ok: false;
      error: string;
    };

const DEFAULT_NAMESPACE = 'runtime';

function toBundleKey(fullKey: string, namespace: string): string {
  const prefix = `${namespace}.`;
  if (fullKey.startsWith(prefix)) return fullKey.slice(prefix.length);
  return fullKey;
}

function fromBundleKey(key: string, namespace: string): string {
  if (key.startsWith(`${namespace}.`)) return key;
  return `${namespace}.${key}`;
}

export default function TranslationsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [locale, setLocale] = useState('en');
  const [namespace, setNamespace] = useState(DEFAULT_NAMESPACE);
  const [tenantLocale, setTenantLocale] = useState('en');
  const [userLocale, setUserLocale] = useState('en');
  const [fallbackLocale, setFallbackLocale] = useState('en');
  const [snapshot, setSnapshot] = useState<Extract<TranslationSnapshot, { ok: true }> | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const load = async (next?: {
    locale?: string;
    namespace?: string;
    tenantLocale?: string;
    userLocale?: string;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('locale', next?.locale ?? locale);
      params.set('namespace', next?.namespace ?? namespace);
      params.set('tenantLocale', next?.tenantLocale ?? tenantLocale);
      params.set('userLocale', next?.userLocale ?? userLocale);

      const response = await apiGet<TranslationSnapshot>(`/api/translations?${params.toString()}`);
      if (!response.ok) {
        throw new Error(response.error);
      }

      setSnapshot(response);
      setLocale(response.locale);
      setNamespace(response.namespace);
      setTenantLocale(response.tenantLocale);
      setUserLocale(response.userLocale);
      setFallbackLocale(response.fallbackLocale);

      const seededDrafts: Record<string, string> = {};
      for (const key of response.requiredKeys) {
        const bundleKey = toBundleKey(key, response.namespace);
        seededDrafts[key] = response.messages[bundleKey] ?? '';
      }
      setDraftValues(seededDrafts);
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to load translations',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const requiredRows = useMemo(() => {
    if (!snapshot) return [];
    const needle = filter.trim().toLowerCase();
    return [...snapshot.requiredKeys]
      .sort((a, b) => a.localeCompare(b))
      .filter((key) => !needle || key.toLowerCase().includes(needle));
  }, [filter, snapshot]);

  const missingKeys = useMemo(() => new Set(snapshot?.missingKeys ?? []), [snapshot?.missingKeys]);
  const unresolvedCount = useMemo(
    () =>
      requiredRows.filter((key) => {
        const value = draftValues[key] ?? '';
        return value.trim().length === 0;
      }).length,
    [draftValues, requiredRows],
  );

  const savePreferences = async () => {
    setSaving(true);
    try {
      await apiPost('/api/translations', {
        action: 'preferences',
        tenantLocale,
        userLocale,
        fallbackLocale,
      });
      toast({ variant: 'success', title: 'Locale preferences saved' });
      await load({ locale, namespace, tenantLocale, userLocale });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to save locale preferences',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const saveKey = async (fullKey: string) => {
    const value = draftValues[fullKey] ?? '';
    const key = toBundleKey(fullKey, namespace);
    setSaving(true);
    try {
      await apiPost('/api/translations', {
        action: 'upsert',
        locale,
        namespace,
        key,
        value,
      });
      toast({ variant: 'success', title: `Saved ${fullKey}` });
      await load({ locale, namespace, tenantLocale, userLocale });
    } catch (error) {
      toast({
        variant: 'error',
        title: `Failed to save ${fullKey}`,
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    if (!snapshot) return;
    const changed = snapshot.requiredKeys.filter((fullKey) => {
      const bundleKey = toBundleKey(fullKey, namespace);
      const current = snapshot.messages[bundleKey] ?? '';
      const draft = draftValues[fullKey] ?? '';
      return current !== draft;
    });

    if (changed.length === 0) {
      toast({ variant: 'info', title: 'No changes to save' });
      return;
    }

    setSaving(true);
    try {
      for (const fullKey of changed) {
        const key = toBundleKey(fullKey, namespace);
        await apiPost('/api/translations', {
          action: 'upsert',
          locale,
          namespace,
          key,
          value: draftValues[fullKey] ?? '',
        });
      }
      toast({ variant: 'success', title: `Saved ${changed.length} translation(s)` });
      await load({ locale, namespace, tenantLocale, userLocale });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Bulk save failed',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const locales = snapshot?.locales ?? ['en'];

  return (
    <div className={styles.page} data-testid="translations-page">
      <Card>
        <CardHeader>
          <CardTitle>Translation Editor</CardTitle>
        </CardHeader>
        <CardContent className={styles.panel}>
          <p className={styles.helper}>
            Manage locale dictionaries used by schema i18n keys. Missing keys are highlighted and must be filled before publish.
          </p>

          <div className={styles.controls}>
            <div className={styles.field}>
              <label className="rfFieldLabel">Locale</label>
              <Select
                value={locale}
                onChange={(event) => {
                  const next = event.target.value;
                  setLocale(next);
                  void load({ locale: next, namespace, tenantLocale, userLocale });
                }}
                disabled={loading || saving}
                aria-label="Translation locale"
              >
                {locales.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
            <div className={styles.field}>
              <label className="rfFieldLabel">Namespace</label>
              <Select
                value={namespace}
                onChange={(event) => {
                  const next = event.target.value;
                  setNamespace(next);
                  void load({ locale, namespace: next, tenantLocale, userLocale });
                }}
                disabled={loading || saving}
                aria-label="Translation namespace"
              >
                <option value="runtime">runtime</option>
              </Select>
            </div>
            <div className={styles.field}>
              <label className="rfFieldLabel">Tenant Locale</label>
              <Input
                value={tenantLocale}
                onChange={(event) => setTenantLocale(event.target.value)}
                aria-label="Tenant locale"
              />
            </div>
            <div className={styles.field}>
              <label className="rfFieldLabel">User Locale</label>
              <Input
                value={userLocale}
                onChange={(event) => setUserLocale(event.target.value)}
                aria-label="User locale"
              />
            </div>
            <div className={styles.field}>
              <label className="rfFieldLabel">Fallback Locale</label>
              <Input
                value={fallbackLocale}
                onChange={(event) => setFallbackLocale(event.target.value)}
                aria-label="Fallback locale"
              />
            </div>
            <div className={styles.actions}>
              <Button size="sm" variant="outline" onClick={savePreferences} disabled={saving || loading}>
                Save Locale Preferences
              </Button>
              <Button size="sm" variant="outline" onClick={() => void load()} disabled={saving || loading}>
                Refresh
              </Button>
              <Button size="sm" onClick={saveAll} disabled={saving || loading}>
                Save All Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className={styles.headerRow}>
            <CardTitle>Required Keys</CardTitle>
            <div className={styles.badges}>
              <Badge variant={snapshot?.missingKeys.length ? 'warning' : 'success'}>
                Missing in source: {snapshot?.missingKeys.length ?? 0}
              </Badge>
              <Badge variant={unresolvedCount > 0 ? 'warning' : 'success'}>
                Empty in editor: {unresolvedCount}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className={styles.panel}>
          <div className={styles.field}>
            <label className="rfFieldLabel">Filter Keys</label>
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="runtime.orders.table.label"
              aria-label="Translation key filter"
            />
          </div>

          {loading ? <p className={styles.helper}>Loading translations...</p> : null}

          {!loading && requiredRows.length === 0 ? (
            <p className={styles.helper}>No keys found for this namespace.</p>
          ) : (
            <div className={styles.table}>
              {requiredRows.map((fullKey) => {
                const current = draftValues[fullKey] ?? '';
                const missing = missingKeys.has(fullKey) || current.trim().length === 0;
                const bundleKey = toBundleKey(fullKey, namespace);
                const changed = snapshot ? current !== (snapshot.messages[bundleKey] ?? '') : false;
                return (
                  <div key={fullKey} className={styles.row} data-missing={missing}>
                    <div className={styles.keyCell}>
                      <code>{fullKey}</code>
                      {missing ? <Badge variant="warning">Missing</Badge> : <Badge variant="success">Ready</Badge>}
                    </div>
                    <Input
                      value={current}
                      onChange={(event) =>
                        setDraftValues((prev) => ({
                          ...prev,
                          [fullKey]: event.target.value,
                        }))
                      }
                      aria-label={`Translation value for ${fullKey}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void saveKey(fromBundleKey(bundleKey, namespace))}
                      disabled={saving || !changed}
                    >
                      Save
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
