'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ExecutionContext, JSONValue, UIComponent, UISchema } from '@platform/schema';
import { validateUISchema, type ValidationIssue } from '@platform/validator';
import { RenderPage } from '@platform/react-renderer';
import { registerMaterialAdapters } from '@platform/react-material-adapter';
import { registerAgGridAdapter } from '@platform/react-aggrid-adapter';
import { registerHighchartsAdapter } from '@platform/react-highcharts-adapter';
import { registerD3Adapter } from '@platform/react-d3-adapter';
import { registerCompanyAdapter } from '@platform/react-company-adapter';
import type { ComponentDefinition } from '@platform/component-registry';
import { builtinComponentDefinitions } from '@platform/component-registry';
import { createProviderFromBundles, EXAMPLE_TENANT_BUNDLES, PLATFORM_BUNDLES } from '@platform/i18n';
import { useSearchParams } from 'next/navigation';
import type { ConfigVersion } from '@/lib/demo/types';
import { apiGet, apiPatch, apiPost } from '@/lib/demo/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ComponentEditor } from '@/components/builder/component-editor';
import { SchemaPreview } from '@/components/builder/schema-preview';
import { CanvasItem } from '@/components/builder/canvas-item';
import { useToast } from '@/components/ui/toast';
import styles from './builder.module.css';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

type GetRegistryResponse =
  | { ok: true; tenantId: string; effective: ComponentDefinition[] }
  | { ok: false; error: string };

const previewContext: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'builder',
  role: 'author',
  roles: ['author'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
  device: 'desktop',
  permissions: ['read'],
  featureFlags: { demo: true },
};

const previewData: Record<string, JSONValue> = {
  orderTotal: 1200,
  loanAmount: 250000,
  riskLevel: 'Medium',
  orders: [],
  revenueSeries: [2, 7, 4, 9],
};

const BUILTIN_COMPONENT_DEFS = builtinComponentDefinitions();
const DEFAULT_ADAPTER_HINT = BUILTIN_COMPONENT_DEFS[0]?.adapterHint ?? 'material.input';

function normalizeFocusOrder(components: UIComponent[]) {
  return components.map((component, index) => ({
    ...component,
    accessibility: {
      ...(component.accessibility ?? {}),
      keyboardNav: true,
      focusOrder: index + 1,
      ariaLabelKey: component.accessibility?.ariaLabelKey ?? `runtime.builder.${component.id}.aria`,
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

function nextId(base: string, existing: Set<string>) {
  const cleaned = base.replace(/[^a-zA-Z0-9_-]/g, '') || 'component';
  if (!existing.has(cleaned)) return cleaned;
  let n = 2;
  while (existing.has(`${cleaned}${n}`)) n += 1;
  return `${cleaned}${n}`;
}

function toTestIdSuffix(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function buildComponentFromRegistry(def: ComponentDefinition, id: string): UIComponent {
  const type = deriveType(def.adapterHint);
  return {
    id,
    type,
    adapterHint: def.adapterHint,
    props: def.defaultProps ? (JSON.parse(JSON.stringify(def.defaultProps)) as UIComponent['props']) : undefined,
    accessibility: {
      ariaLabelKey: `runtime.builder.${id}.aria`,
      keyboardNav: true,
      focusOrder: 1,
    },
  };
}

function CanvasDropZone({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { isOver, setNodeRef, active } = useDroppable({ id: 'canvas', disabled });
  const highlight = isOver && Boolean(active);
  return (
    <div
      ref={setNodeRef}
      data-testid="builder-canvas"
      className={cn(styles.canvasZone, highlight ? styles.canvasZoneOver : undefined)}
    >
      {children}
    </div>
  );
}

function PaletteItem({
  def,
  selected,
  disabled,
  onSelect,
}: {
  def: ComponentDefinition;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const id = `palette:${def.adapterHint}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { kind: 'palette', adapterHint: def.adapterHint, label: def.displayName },
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      data-testid={`palette-item-${toTestIdSuffix(def.adapterHint)}`}
      className={`${styles.paletteButton} ${selected ? styles.paletteButtonActive : ''}`}
      onClick={onSelect}
      disabled={disabled}
      {...attributes}
      {...listeners}
    >
      <span>{def.displayName}</span>
      <Badge variant="muted">{def.adapterHint}</Badge>
    </button>
  );
}

export default function BuilderPage() {
  const searchParams = useSearchParams();
  const versionId = searchParams.get('versionId');
  const previewFromUrl = searchParams.get('preview');
  const { toast } = useToast();
  const { completeStep, setActiveVersionId } = useOnboarding();

  const [loading, setLoading] = useState(false);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registry, setRegistry] = useState<ComponentDefinition[]>(() => BUILTIN_COMPONENT_DEFS);
  const [loadedVersion, setLoadedVersion] = useState<ConfigVersion | null>(null);
  const [components, setComponents] = useState<UIComponent[]>(() => normalizeFocusOrder(scratchComponents));
  const [schemaVersion, setSchemaVersion] = useState('1.0.0');
  const [pageId, setPageId] = useState('builder-preview');
  const [columns, setColumns] = useState(1);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(() => scratchComponents[0]?.id ?? null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<ExecutionContext['device']>('desktop');

  const [draft, setDraft] = useState({
    id: '',
    adapterHint: DEFAULT_ADAPTER_HINT,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
  );
  const [activeDrag, setActiveDrag] = useState<{ kind: 'palette' | 'component'; label: string } | null>(null);

  useEffect(() => {
    registerMaterialAdapters();
    registerAgGridAdapter();
    registerHighchartsAdapter();
    registerD3Adapter();
    registerCompanyAdapter();
  }, []);

  useEffect(() => {
    if (previewFromUrl === '1') setPreviewMode(true);
  }, [previewFromUrl]);

  useEffect(() => {
    if (!previewMode) return;
    completeStep('previewUi');
  }, [completeStep, previewMode]);

  useEffect(() => {
    const loadRegistry = async () => {
      setRegistryLoading(true);
      try {
        const resp = await apiGet<GetRegistryResponse>('/api/component-registry');
        if (!resp.ok) throw new Error(resp.error);
        setRegistry(resp.effective);
      } catch (error) {
        toast({
          variant: 'error',
          title: 'Failed to load component registry',
          description: error instanceof Error ? error.message : String(error),
        });
        setRegistry(BUILTIN_COMPONENT_DEFS);
      } finally {
        setRegistryLoading(false);
      }
    };
    void loadRegistry();
  }, [toast]);

  useEffect(() => {
    if (registry.length === 0) return;
    setDraft((current) => {
      if (registry.some((def) => def.adapterHint === current.adapterHint)) return current;
      return { ...current, adapterHint: registry[0]!.adapterHint };
    });
  }, [registry]);

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

  useEffect(() => {
    if (!selectedComponentId) return;
    if (components.some((c) => c.id === selectedComponentId)) return;
    setSelectedComponentId(components[0]?.id ?? null);
  }, [components, selectedComponentId]);

  const loadFromStore = async () => {
    if (!versionId) return;
    setLoading(true);
    try {
      const response = await apiGet<GetVersionResponse>(`/api/config-versions/${encodeURIComponent(versionId)}`);
      if (!response.ok) throw new Error(response.error);

      const uiSchema = response.version.bundle.uiSchema;
      const normalized = normalizeFocusOrder(uiSchema.components as UIComponent[]);

      setLoadedVersion(response.version);
      setSchemaVersion(uiSchema.version ?? '1.0.0');
      setPageId(uiSchema.pageId ?? 'builder-preview');

      const layout = uiSchema.layout;
      setColumns(layout.type === 'grid' && typeof layout.columns === 'number' ? layout.columns : 1);
      setComponents(normalized);
      setSelectedComponentId(normalized[0]?.id ?? null);

      setActiveVersionId(versionId);
      toast({ variant: 'info', title: 'Loaded config', description: response.version.version });
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load config', description: error instanceof Error ? error.message : String(error) });
      setLoadedVersion(null);
      setComponents(normalizeFocusOrder(scratchComponents));
      setSelectedComponentId(scratchComponents[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFromStore();
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

    const def = registry.find((p) => p.adapterHint === draft.adapterHint) ?? registry[0];
    if (!def) return;

    const nextComponent = buildComponentFromRegistry(def, trimmedId);
    const next = normalizeFocusOrder([...components, nextComponent]);
    setComponents(next);
    setSelectedComponentId(nextComponent.id);
    setDraft((current) => ({ ...current, id: '' }));
    toast({ variant: 'success', title: 'Component added', description: trimmedId });
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
      const result = await apiPatch<{ ok: true } | { ok: false; error: string }>(
        `/api/config-versions/${encodeURIComponent(versionId)}/ui-schema`,
        {
          uiSchema: schema,
        },
      );
      if (!result.ok) throw new Error(result.error);
      toast({ variant: 'success', title: 'Saved UI schema' });
      setActiveVersionId(versionId);
      completeStep('editUi');
      completeStep('saveDb');
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

  const selectedComponent = selectedComponentId ? components.find((c) => c.id === selectedComponentId) ?? null : null;
  const selectedDefinition =
    selectedComponent ? registry.find((def) => def.adapterHint === selectedComponent.adapterHint) ?? null : null;

  const focusComponent = (componentId: string) => {
    setSelectedComponentId(componentId);
    window.setTimeout(() => {
      const safe = componentId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const el = document.querySelector(`[data-component-id="${safe}"]`);
      if (el && el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const effectivePreviewContext = useMemo(
    () => ({ ...previewContext, device: previewDevice }),
    [previewDevice],
  );
  const previewMaxWidth = previewDevice === 'mobile' ? 390 : previewDevice === 'tablet' ? 820 : 1280;
  const baseLocale = previewContext.locale.split('-')[0] ?? previewContext.locale;
  const i18n = useMemo(
    () =>
      createProviderFromBundles({
        locale: baseLocale,
        fallbackLocale: 'en',
        bundles: [...PLATFORM_BUNDLES, ...EXAMPLE_TENANT_BUNDLES],
        mode: 'dev',
      }),
    [baseLocale],
  );

  const onDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (activeId.startsWith('palette:')) {
      setActiveDrag({ kind: 'palette', label: String(event.active.data.current?.label ?? 'Palette item') });
      return;
    }
    setActiveDrag({ kind: 'component', label: activeId });
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    const activeId = String(active.id);
    if (!over) {
      if (activeId.startsWith('palette:')) {
        toast({ variant: 'error', title: 'Drop failed', description: 'Drop onto the canvas to add a component.' });
      }
      return;
    }
    const overId = String(over.id);

    if (activeId.startsWith('palette:')) {
      const adapterHint = activeId.slice('palette:'.length);
      const def = registry.find((p) => p.adapterHint === adapterHint);
      if (!def) return;

      const existingIds = new Set(components.map((c) => c.id));
      const base = deriveType(adapterHint);
      const id = nextId(base, existingIds);
      const nextComponent = buildComponentFromRegistry(def, id);

      const insertIndex = overId === 'canvas' ? components.length : components.findIndex((c) => c.id === overId);
      const next = normalizeFocusOrder(
        insertIndex >= 0
          ? [...components.slice(0, insertIndex), nextComponent, ...components.slice(insertIndex)]
          : [...components, nextComponent],
      );

      setComponents(next);
      setSelectedComponentId(id);
      toast({ variant: 'success', title: 'Dropped component', description: id });
      return;
    }

    if (activeId === overId) return;
    const oldIndex = components.findIndex((c) => c.id === activeId);
    const newIndex = components.findIndex((c) => c.id === overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = normalizeFocusOrder(arrayMove(components, oldIndex, newIndex));
      setComponents(next);
  };

  return (
    <div className={styles.page}>
      <Card>
        <CardHeader>
          <div className={styles.headerRow}>
            <div>
              <CardTitle>Schema Builder</CardTitle>
              <p className={styles.subtext}>
                {versionId ? (
                  <>
                    Editing <span className="rfCodeInline">{versionId}</span>
                    {loadedVersion ? ` - ${loadedVersion.status}` : null}
                  </>
                ) : (
                  'Scratch schema (not persisted). Use New Config to create a stored package.'
                )}
              </p>
            </div>
            <div className={styles.actions}>
              <Button variant="outline" size="sm" onClick={loadFromStore} disabled={!versionId || loading}>
                Reload
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreviewMode((v) => !v)} disabled={loading}>
                {previewMode ? 'Exit preview' : 'Preview'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={submitForReview}
                disabled={!versionId || loading || !validation.valid}
                title={!validation.valid ? 'Fix validation issues before submitting for review' : undefined}
              >
                Submit for review
              </Button>
              <Button
                size="sm"
                onClick={saveToStore}
                disabled={!versionId || loading || !validation.valid}
                title={!validation.valid ? 'Fix validation issues to enable Save' : undefined}
              >
                {loading ? 'Working...' : 'Save'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className={styles.metaGrid}>
          <div>
            <label className="rfFieldLabel">Schema Version</label>
            <Input value={schemaVersion} onChange={(e) => setSchemaVersion(e.target.value)} />
          </div>
          <div>
            <label className="rfFieldLabel">Page Id</label>
            <Input value={pageId} onChange={(e) => setPageId(e.target.value)} />
          </div>
          <div>
            <label className="rfFieldLabel">Columns</label>
            <Input type="number" value={columns} onChange={(e) => setColumns(Number(e.target.value) || 1)} />
          </div>
        </CardContent>
      </Card>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {previewMode ? (
          <Card>
            <CardHeader>
              <div className={styles.canvasHeaderRow}>
                <CardTitle>Preview Mode</CardTitle>
                <div className={styles.actions}>
                  <Select
                    value={previewDevice}
                    onChange={(e) => setPreviewDevice(e.target.value as ExecutionContext['device'])}
                    disabled={loading}
                    aria-label="Preview breakpoint"
                  >
                    <option value="desktop">Desktop</option>
                    <option value="tablet">Tablet</option>
                    <option value="mobile">Mobile</option>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setPreviewMode(false)} disabled={loading}>
                    Back to editing
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className={styles.previewContent}>
              <div className={styles.previewFrameWrap}>
                <div className={styles.previewFrame} style={{ width: previewMaxWidth, maxWidth: '100%' }}>
                  <RenderPage uiSchema={schema} data={previewData} context={effectivePreviewContext} i18n={i18n} />
                </div>
              </div>
              <p className={styles.canvasHint}>Switch breakpoints to validate responsive layout.</p>
            </CardContent>
          </Card>
        ) : (
        <div className={styles.builderGrid}>
          <Card>
            <CardHeader>
              <CardTitle>Component Palette</CardTitle>
            </CardHeader>
            <CardContent className={styles.paletteContent}>
              {registryLoading ? <p className={styles.canvasHint}>Loading registry...</p> : null}
              {registry.map((def) => (
                <PaletteItem
                  key={def.adapterHint}
                  def={def}
                  selected={draft.adapterHint === def.adapterHint}
                  disabled={loading || registryLoading}
                  onSelect={() => setDraft((current) => ({ ...current, adapterHint: def.adapterHint }))}
                />
              ))}

              <div className={styles.addSection}>
                <p className={styles.addTitle}>Quick Add (optional)</p>
                <div className={styles.addStack}>
                  <Input
                    placeholder="Component id"
                    value={draft.id}
                    onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))}
                  />
                  <Button size="sm" onClick={addComponent} disabled={loading}>
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className={styles.canvasHeaderRow}>
                <CardTitle>Canvas</CardTitle>
                <Badge variant={validation.valid ? 'success' : 'warning'}>
                  {validation.valid ? 'Valid' : `${validation.issues.length} Issues`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className={styles.canvasContent}>
              <CanvasDropZone disabled={loading}>
                {components.length === 0 ? <p className={styles.canvasEmptyHint}>Drag from the palette to start.</p> : null}
                <SortableContext items={components.map((c) => c.id)} strategy={rectSortingStrategy}>
                  <RenderPage
                    uiSchema={schema}
                    data={previewData}
                    context={previewContext}
                    i18n={i18n}
                    componentWrapper={(component, rendered) => (
                      <CanvasItem
                        component={component}
                        selected={component.id === selectedComponentId}
                        disabled={loading}
                        onSelect={() => setSelectedComponentId(component.id)}
                      >
                        {rendered}
                      </CanvasItem>
                    )}
                  />
                </SortableContext>
              </CanvasDropZone>
              <p className={styles.canvasHint}>Drag to reorder. Click a component to edit its properties.</p>
            </CardContent>
          </Card>

          <div className={styles.canvasContent}>
            {selectedComponent ? (
              <ComponentEditor
                component={selectedComponent}
                definition={selectedDefinition}
                registry={registry}
                issues={issuesByComponentId.get(selectedComponent.id)}
                onChange={(next) =>
                  setComponents((current) => normalizeFocusOrder(current.map((item) => (item.id === next.id ? next : item))))
                }
                onRemove={() => {
                  setComponents((current) => normalizeFocusOrder(current.filter((item) => item.id !== selectedComponent.id)));
                  toast({ variant: 'info', title: 'Component removed', description: selectedComponent.id });
                }}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Properties</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={styles.emptyText}>Select a component on the canvas to edit its properties.</p>
                </CardContent>
              </Card>
            )}

            <SchemaPreview
              schema={schema}
              issues={validation.issues}
              resolveComponentId={(path) => extractComponentIdFromIssue(path, components)}
              onFocusComponentId={focusComponent}
            />
          </div>
        </div>
        )}

        <DragOverlay>
          {activeDrag ? (
            <div className={styles.dragOverlay}>
              <div className={styles.dragOverlayTitle}>{activeDrag.label}</div>
              <div className={styles.dragOverlaySub}>{activeDrag.kind === 'palette' ? 'Palette item' : 'Canvas item'}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function deriveType(adapterHint: string): string {
  const parts = adapterHint.split('.');
  return parts[parts.length - 1] || adapterHint;
}
