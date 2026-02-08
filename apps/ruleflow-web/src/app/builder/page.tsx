'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UIComponent, UISchema } from '@platform/schema';
import { validateUISchema, type ValidationIssue } from '@platform/validator';
import { useSearchParams } from 'next/navigation';
import type { ConfigVersion } from '@/lib/demo/types';
import { apiGet, apiPatch, apiPost } from '@/lib/demo/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ComponentEditor } from '@/components/builder/component-editor';
import { SchemaPreview } from '@/components/builder/schema-preview';
import { useToast } from '@/components/ui/toast';

const palette = [
  { label: 'Text Field', adapterHint: 'material.input' },
  { label: 'Button', adapterHint: 'material.button' },
  { label: 'AG-Grid Table', adapterHint: 'aggrid.table' },
  { label: 'Highcharts', adapterHint: 'highcharts.chart' },
  { label: 'D3 Custom', adapterHint: 'd3.custom' },
];

const scratchComponents: UIComponent[] = [
  {
    id: 'customerName',
    type: 'input',
    adapterHint: 'material.input',
    props: { label: 'Customer name' },
    i18n: {
      labelKey: 'runtime.filters.customerName.label',
      placeholderKey: 'runtime.filters.customerName.placeholder',
      helperTextKey: 'runtime.filters.customerName.helper',
    },
    accessibility: {
      ariaLabelKey: 'runtime.filters.customerName.aria',
      keyboardNav: true,
      focusOrder: 1,
    },
  },
  {
    id: 'ordersTable',
    type: 'table',
    adapterHint: 'aggrid.table',
    props: {
      columns: [
        { field: 'orderId', headerKey: 'runtime.orders.table.columns.orderId' },
        { field: 'customer', headerKey: 'runtime.orders.table.columns.customer' },
        { field: 'total', headerKey: 'runtime.orders.table.columns.total' },
      ],
      rows: [],
    },
    i18n: {
      labelKey: 'runtime.orders.table.label',
    },
    accessibility: {
      ariaLabelKey: 'runtime.orders.table.aria',
      keyboardNav: true,
      focusOrder: 2,
    },
  },
];

type GetVersionResponse = { ok: true; version: ConfigVersion } | { ok: false; error: string };

function normalizeFocusOrder(components: UIComponent[]) {
  return components.map((component, index) => ({
    ...component,
    accessibility: {
      ...(component.accessibility ?? {}),
      keyboardNav: true,
      focusOrder: index + 1,
      ariaLabelKey: component.accessibility?.ariaLabelKey ?? 'runtime.aria.missing',
    },
  }));
}

function extractComponentIdFromIssue(path: string, components: UIComponent[]): string | null {
  if (!path.startsWith('components.')) return null;
  const rest = path.slice('components.'.length);
  const first = rest.split('.')[0] ?? '';
  if (!first) return null;

  if (/^[0-9]+$/.test(first)) {
    const index = Number(first);
    const component = components[index];
    return component?.id ?? null;
  }

  // validateAccessibility uses `components.<componentId>...`
  const exists = components.some((c) => c.id === first);
  return exists ? first : null;
}

export default function BuilderPage() {
  const searchParams = useSearchParams();
  const versionId = searchParams.get('versionId');
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState<ConfigVersion | null>(null);
  const [components, setComponents] = useState<UIComponent[]>(scratchComponents);
  const [schemaVersion, setSchemaVersion] = useState('1.0.0');
  const [pageId, setPageId] = useState('builder-preview');
  const [columns, setColumns] = useState(1);

  const [draft, setDraft] = useState({
    id: '',
    adapterHint: palette[0]?.adapterHint ?? 'material.input',
    labelKey: 'runtime.filters.customerName.label',
    ariaLabelKey: 'runtime.filters.customerName.aria',
  });

  const schema: UISchema = useMemo(
    () => ({
      version: schemaVersion,
      pageId,
      layout: {
        id: 'root',
        type: 'grid',
        columns,
        componentIds: components.map((component) => component.id),
      },
      components,
    }),
    [columns, components, pageId, schemaVersion],
  );

  const validation = useMemo(() => validateUISchema(schema), [schema]);

  const issuesByComponentId = useMemo(() => {
    const map = new Map<string, ValidationIssue[]>();
    for (const issue of validation.issues) {
      const componentId = extractComponentIdFromIssue(issue.path, components);
      if (!componentId) continue;
      const list = map.get(componentId) ?? [];
      list.push(issue);
      map.set(componentId, list);
    }
    return map;
  }, [components, validation.issues]);

  const loadFromStore = async () => {
    if (!versionId) return;
    setLoading(true);
    try {
      const response = await apiGet<GetVersionResponse>(`/api/config-versions/${encodeURIComponent(versionId)}`);
      if (!response.ok) {
        throw new Error(response.error);
      }

      const uiSchema = response.version.bundle.uiSchema;
      setLoadedVersion(response.version);
      setSchemaVersion(uiSchema.version ?? '1.0.0');
      setPageId(uiSchema.pageId ?? 'builder-preview');
      setColumns(uiSchema.layout?.type === 'grid' && typeof (uiSchema.layout as any).columns === 'number' ? (uiSchema.layout as any).columns : 1);
      setComponents(normalizeFocusOrder(uiSchema.components as UIComponent[]));
      toast({ variant: 'info', title: 'Loaded config', description: response.version.version });
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load config', description: error instanceof Error ? error.message : String(error) });
      setLoadedVersion(null);
      setComponents(scratchComponents);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFromStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  const addComponent = () => {
    const trimmedId = draft.id.trim();
    if (!trimmedId) {
      toast({ variant: 'error', title: 'Component id is required' });
      return;
    }
    if (components.some((component) => component.id === trimmedId)) {
      toast({ variant: 'error', title: 'Duplicate component id', description: trimmedId });
      return;
    }

    const nextComponent: UIComponent = {
      id: trimmedId,
      type: deriveType(draft.adapterHint),
      adapterHint: draft.adapterHint,
      i18n: {
        labelKey: draft.labelKey,
      },
      accessibility: {
        ariaLabelKey: draft.ariaLabelKey,
        keyboardNav: true,
        focusOrder: components.length + 1,
      },
    };

    setComponents((current) => normalizeFocusOrder([...current, nextComponent]));
    setDraft((current) => ({ ...current, id: '' }));
    toast({ variant: 'success', title: 'Component added', description: trimmedId });
  };

  const moveComponent = (componentId: string, direction: -1 | 1) => {
    setComponents((current) => {
      const index = current.findIndex((c) => c.id === componentId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(nextIndex, 0, item);
      return normalizeFocusOrder(next);
    });
  };

  const saveToStore = async () => {
    if (!versionId) {
      toast({ variant: 'error', title: 'No versionId', description: 'Create a config first via New Config.' });
      return;
    }

    if (!validation.valid) {
      toast({ variant: 'error', title: 'Fix validation issues before saving', description: `${validation.issues.length} issue(s)` });
      return;
    }

    setLoading(true);
    try {
      const result = await apiPatch<{ ok: true } | { ok: false; error: string }>(`/api/config-versions/${encodeURIComponent(versionId)}`, {
        uiSchema: schema,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      toast({ variant: 'success', title: 'Saved UI schema' });
      await loadFromStore();
    } catch (error) {
      toast({ variant: 'error', title: 'Save failed', description: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  const submitForReview = async () => {
    if (!versionId) return;
    setLoading(true);
    try {
      await apiPost(`/api/config-versions/${encodeURIComponent(versionId)}/submit-review`, {
        scope: 'Tenant: Horizon Bank',
        risk: 'Medium',
      });
      toast({ variant: 'success', title: 'Submitted for review' });
    } catch (error) {
      toast({ variant: 'error', title: 'Submit failed', description: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Schema Builder</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {versionId ? (
                  <>
                    Editing <span className="font-mono text-foreground">{versionId}</span>
                    {loadedVersion ? ` · ${loadedVersion.status}` : null}
                  </>
                ) : (
                  'Scratch schema (not persisted). Use New Config to create a stored package.'
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadFromStore} disabled={!versionId || loading}>
                Reload
              </Button>
              <Button variant="outline" size="sm" onClick={submitForReview} disabled={!versionId || loading}>
                Submit for review
              </Button>
              <Button size="sm" onClick={saveToStore} disabled={!versionId || loading || !validation.valid}>
                {loading ? 'Working…' : 'Save'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Schema Version</label>
            <Input value={schemaVersion} onChange={(e) => setSchemaVersion(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Page Id</label>
            <Input value={pageId} onChange={(e) => setPageId(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Columns</label>
            <Input type="number" value={columns} onChange={(e) => setColumns(Number(e.target.value) || 1)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Component Palette</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {palette.map((item) => (
              <button
                key={item.adapterHint}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/40"
                onClick={() => setDraft((current) => ({ ...current, adapterHint: item.adapterHint }))}
              >
                <span>{item.label}</span>
                <Badge variant="muted">{item.adapterHint}</Badge>
              </button>
            ))}
            <div className="pt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Add Component</p>
              <div className="mt-2 space-y-2">
                <Input placeholder="Component id" value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
                <Input placeholder="Label key" value={draft.labelKey} onChange={(event) => setDraft((current) => ({ ...current, labelKey: event.target.value }))} />
                <Input placeholder="Aria label key" value={draft.ariaLabelKey} onChange={(event) => setDraft((current) => ({ ...current, ariaLabelKey: event.target.value }))} />
                <Button size="sm" onClick={addComponent}>
                  Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Canvas</CardTitle>
              <Badge variant={validation.valid ? 'success' : 'warning'}>
                {validation.valid ? 'Valid' : `${validation.issues.length} Issues`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {components.map((component, index) => (
              <ComponentEditor
                key={component.id}
                component={component}
                issues={issuesByComponentId.get(component.id)}
                canMoveUp={index > 0}
                canMoveDown={index < components.length - 1}
                onMoveUp={() => moveComponent(component.id, -1)}
                onMoveDown={() => moveComponent(component.id, 1)}
                onChange={(next) =>
                  setComponents((current) => normalizeFocusOrder(current.map((item) => (item.id === next.id ? next : item))))
                }
                onRemove={() => {
                  setComponents((current) => normalizeFocusOrder(current.filter((item) => item.id !== component.id)));
                  toast({ variant: 'info', title: 'Component removed', description: component.id });
                }}
              />
            ))}
            {components.length === 0 ? <p className="text-sm text-muted-foreground">No components yet.</p> : null}
          </CardContent>
        </Card>

        <SchemaPreview schema={schema} issues={validation.issues} />
      </div>
    </div>
  );
}

function deriveType(adapterHint: string): string {
  const parts = adapterHint.split('.');
  return parts[parts.length - 1] || adapterHint;
}
