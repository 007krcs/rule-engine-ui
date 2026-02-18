'use client';

import { useEffect, useMemo, useState } from 'react';
import { callApi } from '@platform/api-orchestrator';
import type { ApiMapping, ExecutionContext, JSONValue, MappingSource } from '@platform/schema';
import { useSearchParams } from 'next/navigation';
import { apiGet, apiPatch } from '@/lib/demo/api-client';
import type { ConfigVersion } from '@/lib/demo/types';
import {
  createDefaultApiMapping,
  hasBlockingIssues,
  normalizeApiMappingsById,
  parseJsonText,
  stringifyJsonValue,
  validateApiMappingsById,
} from '@/lib/builder/flow-api-validators';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { ConditionBuilder } from '@/components/rules/ConditionBuilder';
import {
  conditionFromRule,
  conditionToRule,
  createConditionGroupDraft,
  type ConditionDraft,
} from '@/components/rules/rule-visual-model';
import styles from './api-mappings-builder.module.scss';

type GetVersionResponse = { ok: true; version: ConfigVersion } | { ok: false; error: string };

type RequestSection = 'body' | 'query' | 'headers';
type ResponseSection = 'data' | 'context';

type ConditionEditor = {
  mappingId: string;
  draft: ConditionDraft;
};

const DEFAULT_CONTEXT: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'author',
  roles: ['author'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
  device: 'desktop',
  permissions: ['read'],
  featureFlags: {},
};

async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (url.includes('orders')) {
    return new Response(
      JSON.stringify({
        requestId: `req-${Math.random().toString(16).slice(2, 8)}`,
        orderId: body?.orderId ?? 'ord-demo',
        status: 'accepted',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  return new Response(JSON.stringify({ ok: true, echo: body, url }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function normalizeMappingId(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'mapping';
}

function safeParseRecord(value: string): Record<string, JSONValue> {
  const parsed = parseJsonText(value);
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, JSONValue>;
  }
  return {};
}

function collectPaths(value: JSONValue, basePath: string, maxDepth = 3, depth = 0): string[] {
  if (depth > maxDepth) return [];
  if (value === null || value === undefined) return [basePath];
  if (typeof value !== 'object') return [basePath];
  if (Array.isArray(value)) {
    const out = [basePath];
    const first = value[0];
    if (first !== undefined) {
      out.push(...collectPaths(first, `${basePath}[0]`, maxDepth, depth + 1));
    }
    return out;
  }

  const out: string[] = [basePath];
  for (const [key, child] of Object.entries(value)) {
    const childPath = basePath ? `${basePath}.${key}` : key;
    out.push(...collectPaths(child as JSONValue, childPath, maxDepth, depth + 1));
  }
  return out;
}

export default function ApiMappingsBuilderPage() {
  const searchParams = useSearchParams();
  const versionId = searchParams.get('versionId');
  const { toast } = useToast();

  const [version, setVersion] = useState<ConfigVersion | null>(null);
  const [mappingsById, setMappingsById] = useState<Record<string, ApiMapping>>({});
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [newMappingId, setNewMappingId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [conditionEditor, setConditionEditor] = useState<ConditionEditor | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sampleDataText, setSampleDataText] = useState('{\n  "orderId": "INV-2001",\n  "customerName": "ACME Corp"\n}');
  const [sampleContextText, setSampleContextText] = useState(JSON.stringify(DEFAULT_CONTEXT, null, 2));
  const [testResult, setTestResult] = useState<Awaited<ReturnType<typeof callApi>> | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const validationIssues = useMemo(() => validateApiMappingsById(mappingsById), [mappingsById]);
  const hasErrors = hasBlockingIssues(validationIssues);
  const selectedMapping = selectedMappingId ? mappingsById[selectedMappingId] ?? null : null;

  const filteredMappingIds = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const ids = Object.keys(mappingsById);
    if (!q) return ids;
    return ids.filter((id) => {
      const mapping = mappingsById[id];
      if (!mapping) return false;
      return id.toLowerCase().includes(q) || mapping.apiId.toLowerCase().includes(q) || mapping.endpoint.toLowerCase().includes(q);
    });
  }, [mappingsById, searchText]);

  const pathSuggestions = useMemo(() => {
    const data = safeParseRecord(sampleDataText);
    const context = safeParseRecord(sampleContextText);
    const all = new Set<string>([
      'literal:fixedValue',
      ...collectPaths(data as JSONValue, 'data'),
      ...collectPaths(context as JSONValue, 'context'),
    ]);
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [sampleContextText, sampleDataText]);

  useEffect(() => {
    if (!versionId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await apiGet<GetVersionResponse>(`/api/config-versions/${encodeURIComponent(versionId)}`);
        if (!response.ok) throw new Error(response.error);
        if (cancelled) return;
        const normalized = normalizeApiMappingsById(response.version.bundle.apiMappingsById);
        setVersion(response.version);
        setMappingsById(normalized);
        setSelectedMappingId(Object.keys(normalized)[0] ?? null);
        setDirty(false);
      } catch (error) {
        if (cancelled) return;
        toast({
          variant: 'error',
          title: 'Failed to load API mappings',
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [toast, versionId]);

  const updateSelectedMapping = (updater: (mapping: ApiMapping) => ApiMapping) => {
    if (!selectedMappingId) return;
    setMappingsById((current) => {
      const target = current[selectedMappingId];
      if (!target) return current;
      return {
        ...current,
        [selectedMappingId]: updater(target),
      };
    });
    setDirty(true);
  };

  const addMapping = () => {
    const requested = normalizeMappingId(newMappingId || `mapping_${Object.keys(mappingsById).length + 1}`);
    if (mappingsById[requested]) {
      toast({ variant: 'error', title: `Mapping "${requested}" already exists.` });
      return;
    }
    const next = createDefaultApiMapping(requested);
    setMappingsById((current) => ({ ...current, [requested]: next }));
    setSelectedMappingId(requested);
    setNewMappingId('');
    setDirty(true);
  };

  const duplicateMapping = () => {
    if (!selectedMappingId || !selectedMapping) return;
    let nextId = `${selectedMappingId}_copy`;
    while (mappingsById[nextId]) {
      nextId = `${nextId}_1`;
    }
    setMappingsById((current) => ({
      ...current,
      [nextId]: { ...structuredClone(selectedMapping), apiId: nextId },
    }));
    setSelectedMappingId(nextId);
    setDirty(true);
  };

  const deleteMapping = () => {
    if (!selectedMappingId) return;
    const ids = Object.keys(mappingsById).filter((id) => id !== selectedMappingId);
    const nextId = ids[0] ?? null;
    setMappingsById((current) => {
      const next = { ...current };
      delete next[selectedMappingId];
      return next;
    });
    setSelectedMappingId(nextId);
    setDirty(true);
  };

  const updateRequestField = (
    section: RequestSection,
    key: string,
    updater: (value: MappingSource) => MappingSource,
  ) => {
    updateSelectedMapping((mapping) => {
      const sectionMap = { ...(mapping.requestMap[section] ?? {}) };
      const current = sectionMap[key] ?? { from: 'data.value' };
      sectionMap[key] = updater(current);
      return {
        ...mapping,
        requestMap: { ...mapping.requestMap, [section]: sectionMap },
      };
    });
  };

  const renameRequestField = (section: RequestSection, previousKey: string, nextKeyRaw: string) => {
    const nextKey = nextKeyRaw.trim();
    if (!nextKey || nextKey === previousKey) return;
    updateSelectedMapping((mapping) => {
      const sectionMap = { ...(mapping.requestMap[section] ?? {}) };
      if (sectionMap[nextKey]) return mapping;
      const current = sectionMap[previousKey];
      if (!current) return mapping;
      delete sectionMap[previousKey];
      sectionMap[nextKey] = current;
      return { ...mapping, requestMap: { ...mapping.requestMap, [section]: sectionMap } };
    });
  };

  const removeRequestField = (section: RequestSection, key: string) => {
    updateSelectedMapping((mapping) => {
      const sectionMap = { ...(mapping.requestMap[section] ?? {}) };
      delete sectionMap[key];
      return {
        ...mapping,
        requestMap: { ...mapping.requestMap, [section]: sectionMap },
      };
    });
  };

  const addRequestField = (section: RequestSection) => {
    const existing = Object.keys(selectedMapping?.requestMap[section] ?? {});
    let nextKey = `${section}Field`;
    while (existing.includes(nextKey)) {
      nextKey = `${nextKey}1`;
    }
    updateRequestField(section, nextKey, () => ({ from: 'data.value' }));
  };

  const updateResponseField = (section: ResponseSection, key: string, nextPath: string) => {
    updateSelectedMapping((mapping) => {
      const sectionMap = { ...(mapping.responseMap[section] ?? {}) };
      sectionMap[key] = nextPath;
      return {
        ...mapping,
        responseMap: { ...mapping.responseMap, [section]: sectionMap },
      };
    });
  };

  const renameResponseField = (section: ResponseSection, previousKey: string, nextKeyRaw: string) => {
    const nextKey = nextKeyRaw.trim();
    if (!nextKey || nextKey === previousKey) return;
    updateSelectedMapping((mapping) => {
      const sectionMap = { ...(mapping.responseMap[section] ?? {}) };
      if (sectionMap[nextKey]) return mapping;
      const current = sectionMap[previousKey];
      if (!current) return mapping;
      delete sectionMap[previousKey];
      sectionMap[nextKey] = current;
      return {
        ...mapping,
        responseMap: { ...mapping.responseMap, [section]: sectionMap },
      };
    });
  };

  const removeResponseField = (section: ResponseSection, key: string) => {
    updateSelectedMapping((mapping) => {
      const sectionMap = { ...(mapping.responseMap[section] ?? {}) };
      delete sectionMap[key];
      return {
        ...mapping,
        responseMap: { ...mapping.responseMap, [section]: sectionMap },
      };
    });
  };

  const addResponseField = (section: ResponseSection) => {
    const existing = Object.keys(selectedMapping?.responseMap[section] ?? {});
    let nextKey = section === 'data' ? 'data.field' : 'context.field';
    while (existing.includes(nextKey)) {
      nextKey = `${nextKey}1`;
    }
    updateResponseField(section, nextKey, section === 'data' ? 'response.value' : 'response.value');
  };

  const save = async () => {
    if (!versionId) return;
    if (hasErrors) {
      toast({ variant: 'error', title: 'Fix validation errors before saving.' });
      return;
    }
    setSaving(true);
    try {
      const response = await apiPatch<{ ok: true } | { ok: false; error: string }>(
        `/api/config-versions/${encodeURIComponent(versionId)}/api-mappings`,
        { apiMappingsById: mappingsById },
      );
      if (!response.ok) throw new Error(response.error);
      setDirty(false);
      toast({ variant: 'success', title: 'API mappings saved.' });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to save API mappings',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!selectedMapping) return;
    setTestError(null);
    try {
      const data = safeParseRecord(sampleDataText);
      const context = safeParseRecord(sampleContextText) as unknown as ExecutionContext;
      const result = await callApi({
        mapping: selectedMapping,
        context: { ...DEFAULT_CONTEXT, ...context },
        data,
        fetchFn: demoFetch,
      });
      setTestResult(result);
    } catch (error) {
      setTestResult(null);
      setTestError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className={styles.page}>
      <Card>
        <CardHeader>
          <div className={styles.headerRow}>
            <div>
              <CardTitle>API Mapping Builder</CardTitle>
              <p className={styles.subtext}>
                Define REST mappings visually and test with sample context/data.
                {version ? ` Editing ${version.version} (${version.status})` : ''}
              </p>
            </div>
            <div className={styles.headerActions}>
              <a className={styles.linkButton} href={versionId ? `/playground?versionId=${encodeURIComponent(versionId)}` : '/playground'}>
                Open Playground
              </a>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()} disabled={loading || saving}>
                Reload
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={loading || saving || !dirty || hasErrors} data-testid="api-mappings-save-button">
                {saving ? 'Saving...' : 'Save Mappings'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className={styles.workspace}>
        <Card className={styles.leftPane}>
          <CardHeader>
            <CardTitle>Mappings</CardTitle>
          </CardHeader>
          <CardContent className={styles.leftBody}>
            <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search mappings..." />
            <div className={styles.addRow}>
              <Input value={newMappingId} onChange={(event) => setNewMappingId(event.target.value)} placeholder="newMapping" />
              <Button size="sm" onClick={addMapping}>Add</Button>
            </div>
            <div className={styles.mappingList}>
              {filteredMappingIds.map((mappingId) => (
                <button
                  key={mappingId}
                  type="button"
                  className={selectedMappingId === mappingId ? `${styles.mappingItem} ${styles.mappingItemActive}` : styles.mappingItem}
                  onClick={() => setSelectedMappingId(mappingId)}
                  data-testid={`api-mapping-item-${mappingId}`}
                >
                  <span>{mappingId}</span>
                  <small>{mappingsById[mappingId]?.method} {mappingsById[mappingId]?.endpoint}</small>
                </button>
              ))}
            </div>
            <div className={styles.inlineActions}>
              <Button size="sm" variant="outline" onClick={duplicateMapping} disabled={!selectedMapping}>Duplicate</Button>
              <Button size="sm" variant="outline" onClick={deleteMapping} disabled={!selectedMapping}>Delete</Button>
            </div>
          </CardContent>
        </Card>

        <Card className={styles.rightPane}>
          <CardHeader>
            <CardTitle>Editor</CardTitle>
          </CardHeader>
          <CardContent className={styles.rightBody}>
            {!selectedMapping || !selectedMappingId ? (
              <p className={styles.emptyText}>Select a mapping to edit.</p>
            ) : (
              <>
                <datalist id="api-path-suggestions">
                  {pathSuggestions.map((path) => (
                    <option key={path} value={path} />
                  ))}
                </datalist>

                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label className="rfFieldLabel">Mapping Key</label>
                    <Input value={selectedMappingId} readOnly />
                  </div>
                  <div className={styles.field}>
                    <label className="rfFieldLabel">API Id</label>
                    <Input value={selectedMapping.apiId} onChange={(event) => updateSelectedMapping((mapping) => ({ ...mapping, apiId: event.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className="rfFieldLabel">Type</label>
                    <Select value={selectedMapping.type} onChange={(event) => updateSelectedMapping((mapping) => ({ ...mapping, type: event.target.value as ApiMapping['type'] }))}>
                      <option value="rest">REST</option>
                      <option value="graphql">GraphQL</option>
                    </Select>
                  </div>
                  <div className={styles.field}>
                    <label className="rfFieldLabel">Method</label>
                    <Select value={selectedMapping.method} onChange={(event) => updateSelectedMapping((mapping) => ({ ...mapping, method: event.target.value as ApiMapping['method'] }))}>
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </Select>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className="rfFieldLabel">Endpoint</label>
                  <Input value={selectedMapping.endpoint} onChange={(event) => updateSelectedMapping((mapping) => ({ ...mapping, endpoint: event.target.value }))} placeholder="https://api.example.com/orders" />
                </div>

                {(['body', 'query', 'headers'] as RequestSection[]).map((section) => (
                  <div key={section} className={styles.tableSection}>
                    <div className={styles.sectionHeader}>
                      <h3>Request {section}</h3>
                      <Button size="sm" variant="outline" onClick={() => addRequestField(section)}>Add</Button>
                    </div>
                    <div className={`${styles.mappingTable} ${styles.mappingTableRequest}`}>
                      <div className={styles.mappingHead}>
                        <span>Field</span>
                        <span>Source path</span>
                        <span>Transform</span>
                        <span>Default</span>
                        <span />
                      </div>
                      {Object.entries(selectedMapping.requestMap[section] ?? {}).map(([key, source]) => (
                        <div key={key} className={styles.mappingRow}>
                          <Input defaultValue={key} onBlur={(event) => renameRequestField(section, key, event.target.value)} />
                          <Input value={source.from} onChange={(event) => updateRequestField(section, key, (entry) => ({ ...entry, from: event.target.value }))} list="api-path-suggestions" />
                          <Input value={source.transform ?? ''} onChange={(event) => updateRequestField(section, key, (entry) => ({ ...entry, transform: event.target.value.trim() || undefined }))} placeholder="upper($)" />
                          <Input
                            defaultValue={stringifyJsonValue(source.default)}
                            onBlur={(event) =>
                              updateRequestField(section, key, (entry) => ({
                                ...entry,
                                default: event.target.value.trim() ? parseJsonText(event.target.value) : undefined,
                              }))
                            }
                          />
                          <Button size="sm" variant="outline" onClick={() => removeRequestField(section, key)}>Remove</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {(['data', 'context'] as ResponseSection[]).map((section) => (
                  <div key={section} className={styles.tableSection}>
                    <div className={styles.sectionHeader}>
                      <h3>Response {section}</h3>
                      <Button size="sm" variant="outline" onClick={() => addResponseField(section)}>Add</Button>
                    </div>
                    <div className={`${styles.mappingTable} ${styles.mappingTableResponse}`}>
                      <div className={styles.mappingHead}>
                        <span>Target path</span>
                        <span>Response path</span>
                        <span />
                      </div>
                      {Object.entries(selectedMapping.responseMap[section] ?? {}).map(([key, path]) => (
                        <div key={key} className={styles.mappingRow}>
                          <Input defaultValue={key} onBlur={(event) => renameResponseField(section, key, event.target.value)} />
                          <Input value={path} onChange={(event) => updateResponseField(section, key, event.target.value)} placeholder="response.status" />
                          <Button size="sm" variant="outline" onClick={() => removeResponseField(section, key)}>Remove</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className={styles.sectionHeader}>
                  <h3>Conditions</h3>
                  <div className={styles.inlineActions}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setConditionEditor({
                          mappingId: selectedMappingId,
                          draft: selectedMapping.conditions ? conditionFromRule(selectedMapping.conditions) : createConditionGroupDraft('all'),
                        })
                      }
                    >
                      {selectedMapping.conditions ? 'Edit Condition' : 'Add Condition'}
                    </Button>
                    {selectedMapping.conditions ? (
                      <Button size="sm" variant="outline" onClick={() => updateSelectedMapping((mapping) => ({ ...mapping, conditions: undefined }))}>
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className={styles.testGrid}>
                  <div className={styles.field}>
                    <label className="rfFieldLabel">Sample data</label>
                    <Textarea rows={8} value={sampleDataText} onChange={(event) => setSampleDataText(event.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label className="rfFieldLabel">Sample context</label>
                    <Textarea rows={8} value={sampleContextText} onChange={(event) => setSampleContextText(event.target.value)} />
                  </div>
                </div>
                <div className={styles.inlineActions}>
                  <Button size="sm" onClick={() => void runTest()}>Test Mapping</Button>
                </div>
                {testError ? <p className={styles.errorText}>{testError}</p> : null}
                {testResult ? (
                  <pre className={styles.resultPre} data-testid="api-mapping-test-result">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Validation</CardTitle>
        </CardHeader>
        <CardContent>
          {validationIssues.length === 0 ? (
            <p className={styles.validText}>No validation issues.</p>
          ) : (
            <ul className={styles.issueList}>
              {validationIssues.map((issue) => (
                <li key={`${issue.path}-${issue.message}`} className={issue.severity === 'error' ? styles.issueError : styles.issueWarn}>
                  <span className={styles.issuePath}>{issue.path || 'root'}</span>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {conditionEditor ? (
        <div className={styles.conditionOverlay} role="dialog" aria-modal="true">
          <div className={styles.conditionDialog}>
            <div className={styles.conditionHeader}>
              <h3>Mapping Condition Builder</h3>
              <Button size="sm" variant="outline" onClick={() => setConditionEditor(null)}>Close</Button>
            </div>
            <ConditionBuilder value={conditionEditor.draft} onChange={(next) => setConditionEditor({ ...conditionEditor, draft: next })} />
            <div className={styles.inlineActions}>
              <Button size="sm" variant="outline" onClick={() => setConditionEditor(null)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => {
                  setMappingsById((current) => {
                    const target = current[conditionEditor.mappingId];
                    if (!target) return current;
                    return {
                      ...current,
                      [conditionEditor.mappingId]: {
                        ...target,
                        conditions: conditionToRule(conditionEditor.draft),
                      },
                    };
                  });
                  setDirty(true);
                  setConditionEditor(null);
                }}
              >
                Apply Condition
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
