'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  ExecutionContext,
  JSONValue,
  LayoutBreakpoint,
  UIComponent,
  UIGridItem,
  UISchema,
} from '@platform/schema';
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
import { GridCanvas } from '@/components/builder/grid-canvas';
import {
  createSchemaFromComponents,
  getSchemaGridSpec,
  getSchemaItemsForBreakpoint,
  isSchemaLike,
  listSupportedBreakpoints,
  normalizeFocusOrder,
  normalizeSchema,
  removeComponentFromSchema,
  setSchemaGridSpec,
  upsertSchemaItemsForBreakpoint,
  withUpdatedComponents,
} from '@/components/builder/schema-state';
import { useToast } from '@/components/ui/toast';
import styles from './builder.module.scss';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const BUILDER_LOCAL_STORAGE_KEY = 'ruleflow:builder:schema';

const scratchComponents: UIComponent[] = [
  {
    id: 'customerName',
    type: 'input',
    adapterHint: 'material.input',
    props: {},
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

  const exists = components.some((component) => component.id === first);
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

function clampItem(item: UIGridItem, columns: number): UIGridItem {
  const safeW = Math.max(1, Math.min(columns, Math.trunc(item.w || 1)));
  const safeH = Math.max(1, Math.trunc(item.h || 1));
  const maxX = Math.max(0, columns - safeW);
  return {
    ...item,
    x: Math.max(0, Math.min(maxX, Math.trunc(item.x || 0))),
    y: Math.max(0, Math.trunc(item.y || 0)),
    w: safeW,
    h: safeH,
  };
}

function overlap(a: UIGridItem, b: UIGridItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolveCollisions(
  items: UIGridItem[],
  anchorId: string,
  columns: number,
  strategy: 'push' | 'swap' = 'push',
): UIGridItem[] {
  const normalized = items.map((item) => clampItem(item, columns));
  const anchor = normalized.find((item) => item.componentId === anchorId);
  if (!anchor) return normalized;

  if (strategy === 'swap') {
    const conflict = normalized.find(
      (candidate) => candidate.componentId !== anchor.componentId && overlap(anchor, candidate),
    );
    if (!conflict) return normalized;
    return normalized.map((candidate) => {
      if (candidate.componentId === anchor.componentId) {
        return { ...candidate, x: conflict.x, y: conflict.y };
      }
      if (candidate.componentId === conflict.componentId) {
        return { ...candidate, x: anchor.x, y: anchor.y };
      }
      return candidate;
    });
  }

  const placed: UIGridItem[] = [anchor];
  const rest = normalized
    .filter((item) => item.componentId !== anchor.componentId)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x) || a.componentId.localeCompare(b.componentId));

  for (const current of rest) {
    let candidate = { ...current };
    while (placed.some((item) => overlap(candidate, item))) {
      const blockers = placed.filter((item) => overlap(candidate, item));
      const nextY = Math.max(...blockers.map((item) => item.y + item.h));
      candidate = { ...candidate, y: nextY };
    }
    placed.push(candidate);
  }

  return placed.sort((a, b) => (a.y - b.y) || (a.x - b.x) || a.componentId.localeCompare(b.componentId));
}

function buildComponentFromRegistry(def: ComponentDefinition, id: string): UIComponent {
  const type = deriveType(def.adapterHint);
  const defaultProps = def.defaultProps
    ? stripRawI18nProps(JSON.parse(JSON.stringify(def.defaultProps)) as UIComponent['props'])
    : undefined;
  return {
    id,
    type,
    adapterHint: def.adapterHint,
    props: defaultProps,
    i18n: {
      labelKey: `runtime.builder.${id}.label`,
      helperTextKey: `runtime.builder.${id}.helper`,
      placeholderKey: `runtime.builder.${id}.placeholder`,
    },
    accessibility: {
      ariaLabelKey: `runtime.builder.${id}.aria`,
      keyboardNav: true,
      focusOrder: 1,
    },
  };
}

function stripRawI18nProps(
  props: UIComponent['props'] | undefined,
): UIComponent['props'] {
  if (!props) return props;
  const next = { ...props };
  const keys = ['label', 'helperText', 'placeholder', 'ariaLabel'];
  for (const key of keys) {
    const raw = next[key];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      delete next[key];
    }
  }
  return next;
}

function CanvasDropZone({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { isOver, setNodeRef, active } = useDroppable({ id: 'canvas', disabled });
  const highlight = isOver && Boolean(active);
  return (
    <div
      ref={setNodeRef}
      data-testid="builder-canvas"
      className={cn(styles.canvasZone, styles.builderCanvas, highlight ? styles.canvasZoneOver : undefined)}
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
      {def.palette?.disabled ? <Badge variant="warning">{def.palette.reason ?? 'Planned'}</Badge> : null}
    </button>
  );
}

export default function BuilderPage() {
  const searchParams = useSearchParams();
  const versionId = searchParams.get('versionId');
  const previewFromUrl = searchParams.get('preview');
  const { toast } = useToast();
  const { completeStep, setActiveVersionId } = useOnboarding();

  const [loading, setLoading] = useState(Boolean(versionId));
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registry, setRegistry] = useState<ComponentDefinition[]>(() => BUILTIN_COMPONENT_DEFS);
  const [loadedVersion, setLoadedVersion] = useState<ConfigVersion | null>(null);
  const [schema, setSchema] = useState<UISchema>(() =>
    versionId ? createSchemaFromComponents([]) : createSchemaFromComponents(scratchComponents),
  );
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(() => (versionId ? null : scratchComponents[0]?.id ?? null));
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<ExecutionContext['device']>('desktop');
  const [previewLocale, setPreviewLocale] = useState(previewContext.locale);
  const [activeBreakpoint, setActiveBreakpoint] = useState<LayoutBreakpoint>('lg');
  const [showGridOverlay, setShowGridOverlay] = useState(true);
  const [draft, setDraft] = useState({
    id: '',
    adapterHint: DEFAULT_ADAPTER_HINT,
  });
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const [canvasMetrics, setCanvasMetrics] = useState<{
    cellWidth: number;
    rowHeight: number;
    gap: number;
    canvasRect: DOMRect | null;
  }>({
    cellWidth: 96,
    rowHeight: 56,
    gap: 12,
    canvasRect: null,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeDrag, setActiveDrag] = useState<{ kind: 'palette' | 'component'; label: string } | null>(null);

  const components = useMemo(() => normalizeFocusOrder(schema.components as UIComponent[]), [schema.components]);
  const effectiveSchema = useMemo(
    () =>
      normalizeSchema({
        ...schema,
        components,
      }),
    [components, schema],
  );
  const gridSpec = useMemo(() => getSchemaGridSpec(effectiveSchema), [effectiveSchema]);
  const activeGridSpec = useMemo(() => {
    if (activeBreakpoint === 'lg') {
      return {
        columns: gridSpec.columns,
        rowHeight: gridSpec.rowHeight,
        gap: gridSpec.gap,
      };
    }
    return {
      columns: gridSpec.breakpoints?.[activeBreakpoint]?.columns ?? gridSpec.columns,
      rowHeight: gridSpec.breakpoints?.[activeBreakpoint]?.rowHeight ?? gridSpec.rowHeight,
      gap: gridSpec.breakpoints?.[activeBreakpoint]?.gap ?? gridSpec.gap,
    };
  }, [activeBreakpoint, gridSpec]);
  const activeItems = useMemo(
    () => getSchemaItemsForBreakpoint(effectiveSchema, activeBreakpoint),
    [activeBreakpoint, effectiveSchema],
  );
  const localStorageKey = useMemo(
    () => `${BUILDER_LOCAL_STORAGE_KEY}:${versionId ?? 'scratch'}`,
    [versionId],
  );

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

  useEffect(() => {
    if (!selectedComponentId) return;
    if (components.some((component) => component.id === selectedComponentId)) return;
    setSelectedComponentId(components[0]?.id ?? null);
  }, [components, selectedComponentId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (versionId) return;

    const raw = window.localStorage.getItem(localStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isSchemaLike(parsed)) return;
      const normalized = normalizeSchema(parsed);
      setSchema(normalized);
      setSelectedComponentId((normalized.components as UIComponent[])[0]?.id ?? null);
    } catch {
      // ignore bad local state
    }
  }, [localStorageKey, versionId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(localStorageKey, JSON.stringify(effectiveSchema));
  }, [effectiveSchema, localStorageKey]);

  const validation = useMemo(() => validateUISchema(effectiveSchema), [effectiveSchema]);

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
      if (!response.ok) throw new Error(response.error);

      const normalized = normalizeSchema(response.version.bundle.uiSchema as UISchema);
      const normalizedComponents = normalized.components as UIComponent[];

      setLoadedVersion(response.version);
      setSchema(normalized);
      setSelectedComponentId(normalizedComponents[0]?.id ?? null);
      setActiveVersionId(versionId);
      toast({ variant: 'info', title: 'Loaded config', description: response.version.version });
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load config', description: error instanceof Error ? error.message : String(error) });
      const fallback = createSchemaFromComponents(scratchComponents);
      setLoadedVersion(null);
      setSchema(fallback);
      setSelectedComponentId((fallback.components as UIComponent[])[0]?.id ?? null);
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

    const def = registry.find((item) => item.adapterHint === draft.adapterHint) ?? registry[0];
    if (!def) return;
    if (def.palette?.disabled) {
      toast({
        variant: 'error',
        title: 'Component unavailable',
        description: def.palette.reason ?? 'This component is planned but not implemented yet.',
      });
      return;
    }

    const nextComponent = buildComponentFromRegistry(def, trimmedId);
    setSchema((current) => withUpdatedComponents(current, (currentComponents) => [...currentComponents, nextComponent]));
    setSelectedComponentId(nextComponent.id);
    setDraft((current) => ({ ...current, id: '' }));
    toast({ variant: 'success', title: 'Component added', description: trimmedId });
  };

  const saveToStore = async () => {
    if (!validation.valid) {
      toast({ variant: 'error', title: 'Fix validation issues before saving', description: `${validation.issues.length} issue(s)` });
      return;
    }

    if (!versionId) {
      toast({
        variant: 'success',
        title: 'Saved locally',
        description: 'Schema is stored in browser localStorage for this builder session.',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await apiPatch<{ ok: true } | { ok: false; error: string }>(
        `/api/config-versions/${encodeURIComponent(versionId)}/ui-schema`,
        {
          uiSchema: effectiveSchema,
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

  const selectedComponent = selectedComponentId ? components.find((component) => component.id === selectedComponentId) ?? null : null;
  const selectedDefinition =
    selectedComponent ? registry.find((def) => def.adapterHint === selectedComponent.adapterHint) ?? null : null;

  const focusComponent = (componentId: string) => {
    setSelectedComponentId(componentId);
    window.setTimeout(() => {
      const safe = componentId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const el = document.querySelector(`[data-testid="builder-grid-item-${safe}"]`);
      if (el && el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const effectivePreviewContext = useMemo(
    () => ({ ...previewContext, device: previewDevice, locale: previewLocale }),
    [previewDevice, previewLocale],
  );
  const previewMaxWidth = previewDevice === 'mobile' ? 390 : previewDevice === 'tablet' ? 820 : 1280;
  const baseLocale = previewLocale.split('-')[0] ?? previewLocale;
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

  const updateGridItems = (
    breakpoint: LayoutBreakpoint,
    updater: (items: UIGridItem[]) => UIGridItem[],
    anchorId?: string,
  ) => {
    setSchema((current) => {
      const normalized = normalizeSchema(current);
      const spec = getSchemaGridSpec(normalized);
      const currentItems = getSchemaItemsForBreakpoint(normalized, breakpoint);
      const nextItems = updater(currentItems);
      const resolved =
        anchorId
          ? resolveCollisions(
              nextItems,
              anchorId,
              breakpoint === 'lg'
                ? spec.columns
                : spec.breakpoints?.[breakpoint]?.columns ?? spec.columns,
              spec.collisionStrategy ?? 'push',
            )
          : nextItems;
      return upsertSchemaItemsForBreakpoint(normalized, breakpoint, resolved);
    });
  };

  const updateActiveGridSpec = (partial: Partial<{ columns: number; rowHeight: number; gap: number }>) => {
    setSchema((current) => {
      if (activeBreakpoint === 'lg') {
        return setSchemaGridSpec(current, partial);
      }
      return setSchemaGridSpec(current, {
        breakpoints: {
          [activeBreakpoint]: {
            columns: partial.columns,
            rowHeight: partial.rowHeight,
            gap: partial.gap,
          },
        },
      });
    });
  };

  const moveGridItem = (componentId: string, x: number, y: number) => {
    updateGridItems(
      activeBreakpoint,
      (items) =>
        items.map((item) => (item.componentId === componentId ? { ...item, x, y } : item)),
      componentId,
    );
  };

  const resizeGridItem = (componentId: string, w: number, h: number) => {
    updateGridItems(
      activeBreakpoint,
      (items) =>
        items.map((item) => (item.componentId === componentId ? { ...item, w, h } : item)),
      componentId,
    );
  };

  const removeComponent = (componentId: string) => {
    setSchema((current) => removeComponentFromSchema(current, componentId));
    toast({ variant: 'info', title: 'Component removed', description: componentId });
  };

  const onDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (activeId.startsWith('palette:')) {
      setActiveDrag({ kind: 'palette', label: String(event.active.data.current?.label ?? 'Palette item') });
      return;
    }
    setActiveDrag({
      kind: 'component',
      label: activeId.startsWith('canvas:') ? activeId.slice('canvas:'.length) : activeId,
    });
  };

  const onDragMove = (event: DragMoveEvent) => {
    const translated = event.active.rect.current.translated;
    const initial = event.active.rect.current.initial;
    const rect = translated ?? initial;
    if (!rect) return;
    setDragPointer({ x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 });
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    setDragPointer(null);
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
      const def = registry.find((item) => item.adapterHint === adapterHint);
      if (!def) return;
      if (def.palette?.disabled) {
        toast({
          variant: 'error',
          title: 'Component unavailable',
          description: def.palette.reason ?? 'This component is not implemented yet.',
        });
        return;
      }

      const existingIds = new Set(components.map((component) => component.id));
      const base = deriveType(adapterHint);
      const id = nextId(base, existingIds);
      const nextComponent = buildComponentFromRegistry(def, id);
      setSchema((current) => withUpdatedComponents(current, (currentComponents) => [...currentComponents, nextComponent]));

      const rect = canvasMetrics.canvasRect;
      const pointer = dragPointer;
      if (rect && pointer) {
        const stepX = canvasMetrics.cellWidth + canvasMetrics.gap;
        const stepY = canvasMetrics.rowHeight + canvasMetrics.gap;
        const rawX = Math.floor((pointer.x - rect.left) / stepX);
        const rawY = Math.floor((pointer.y - rect.top) / stepY);
        updateGridItems(
          activeBreakpoint,
          (items) =>
            items.map((item) =>
              item.componentId === id
                ? { ...item, x: Math.max(0, rawX), y: Math.max(0, rawY) }
                : item,
            ),
          id,
        );
      }
      setSelectedComponentId(id);
      toast({ variant: 'success', title: 'Dropped component', description: id });
      return;
    }

    if (activeId.startsWith('canvas:') && overId === 'canvas') {
      const componentId = activeId.slice('canvas:'.length);
      const payload = active.data.current as { x?: number; y?: number } | undefined;
      const startX = Number(payload?.x ?? 0);
      const startY = Number(payload?.y ?? 0);
      const stepX = canvasMetrics.cellWidth + canvasMetrics.gap;
      const stepY = canvasMetrics.rowHeight + canvasMetrics.gap;
      const nextX = Math.max(0, startX + Math.round(event.delta.x / stepX));
      const nextY = Math.max(0, startY + Math.round(event.delta.y / stepY));
      moveGridItem(componentId, nextX, nextY);
    }
  };

  const dragGridCoordinates = useMemo(() => {
    const rect = canvasMetrics.canvasRect;
    if (!dragPointer || !rect) return null;
    const stepX = canvasMetrics.cellWidth + canvasMetrics.gap;
    const stepY = canvasMetrics.rowHeight + canvasMetrics.gap;
    const x = Math.max(0, Math.floor((dragPointer.x - rect.left) / stepX));
    const y = Math.max(0, Math.floor((dragPointer.y - rect.top) / stepY));
    return { x, y };
  }, [canvasMetrics, dragPointer]);

  return (
    <div className={cn(styles.page, styles.builderRoot)}>
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
                  'Scratch schema (stored in localStorage). Use New Config to persist a package.'
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
                disabled={loading || !validation.valid}
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
            <Input
              value={effectiveSchema.version}
              onChange={(event) => setSchema((current) => ({ ...current, version: event.target.value }))}
            />
          </div>
          <div>
            <label className="rfFieldLabel">Page Id</label>
            <Input
              value={effectiveSchema.pageId}
              onChange={(event) => setSchema((current) => ({ ...current, pageId: event.target.value }))}
            />
          </div>
          <div>
            <label className="rfFieldLabel">Columns ({activeBreakpoint.toUpperCase()})</label>
            <Input
              type="number"
              value={activeGridSpec.columns}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                const nextColumns = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
                updateActiveGridSpec({ columns: nextColumns });
              }}
            />
          </div>
          <div>
            <label className="rfFieldLabel">Row Height ({activeBreakpoint.toUpperCase()})</label>
            <Input
              type="number"
              value={activeGridSpec.rowHeight}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                const rowHeight = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 56;
                updateActiveGridSpec({ rowHeight });
              }}
            />
          </div>
          <div>
            <label className="rfFieldLabel">Gap ({activeBreakpoint.toUpperCase()})</label>
            <Input
              type="number"
              value={activeGridSpec.gap}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                const gap = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 12;
                updateActiveGridSpec({ gap });
              }}
            />
          </div>
          <div>
            <label className="rfFieldLabel">Collision</label>
            <Select
              value={gridSpec.collisionStrategy ?? 'push'}
              onChange={(event) =>
                setSchema((current) =>
                  setSchemaGridSpec(current, {
                    collisionStrategy: event.target.value === 'swap' ? 'swap' : 'push',
                  }),
                )
              }
            >
              <option value="push">Push down</option>
              <option value="swap">Swap</option>
            </Select>
          </div>
          <div>
            <label className="rfFieldLabel">Breakpoint</label>
            <Select
              value={activeBreakpoint}
              onChange={(event) => setActiveBreakpoint(event.target.value as LayoutBreakpoint)}
              aria-label="Builder breakpoint"
              data-testid="builder-breakpoint-select"
            >
              {listSupportedBreakpoints().map((breakpoint) => (
                <option key={breakpoint} value={breakpoint}>
                  {breakpoint.toUpperCase()}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="rfFieldLabel">Grid Overlay</label>
            <Select
              value={showGridOverlay ? 'on' : 'off'}
              onChange={(event) => setShowGridOverlay(event.target.value === 'on')}
            >
              <option value="on">On</option>
              <option value="off">Off</option>
            </Select>
          </div>
          <div>
            <label className="rfFieldLabel">Locale</label>
            <Input
              value={previewLocale}
              onChange={(event) => setPreviewLocale(event.target.value)}
              aria-label="Builder locale"
              data-testid="builder-locale-input"
            />
          </div>
        </CardContent>
      </Card>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}>
        {previewMode ? (
          <Card>
            <CardHeader>
              <div className={styles.canvasHeaderRow}>
                <CardTitle>Preview Mode</CardTitle>
                <div className={styles.actions}>
                  <Select
                    value={previewDevice}
                    onChange={(event) => setPreviewDevice(event.target.value as ExecutionContext['device'])}
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
                  <RenderPage uiSchema={effectiveSchema} data={previewData} context={effectivePreviewContext} i18n={i18n} />
                </div>
              </div>
              <p className={styles.canvasHint}>Switch breakpoints to validate responsive layout.</p>
            </CardContent>
          </Card>
        ) : (
          <div className={styles.builderGrid}>
            <Card className={styles.paletteColumn}>
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
                    disabled={loading || registryLoading || Boolean(def.palette?.disabled)}
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
                      data-testid="builder-quick-add-id"
                    />
                    <Button size="sm" onClick={addComponent} disabled={loading} data-testid="builder-quick-add-button">
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={styles.canvasColumn}>
              <CardHeader>
                <div className={styles.canvasHeaderRow}>
                  <CardTitle>Canvas</CardTitle>
                  <div className={styles.actions}>
                    {dragGridCoordinates ? (
                      <Badge variant="muted">
                        {dragGridCoordinates.x},{dragGridCoordinates.y}
                      </Badge>
                    ) : null}
                    <Badge variant={validation.valid ? 'success' : 'warning'}>
                      {validation.valid ? 'Valid' : `${validation.issues.length} Issues`}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={styles.canvasContent}>
                <CanvasDropZone disabled={loading}>
                  {loading && components.length === 0 ? <p className={styles.canvasHint}>Loading schema...</p> : null}
                  {!loading && components.length === 0 ? <p className={styles.canvasEmptyHint}>Drag from the palette to start.</p> : null}
                  <GridCanvas
                    components={components}
                    items={activeItems}
                    columns={activeGridSpec.columns}
                    rowHeight={activeGridSpec.rowHeight}
                    gap={activeGridSpec.gap}
                    selectedComponentId={selectedComponentId}
                    data={previewData}
                    context={effectivePreviewContext}
                    i18n={i18n}
                    disabled={loading}
                    showGrid={showGridOverlay}
                    onSelect={setSelectedComponentId}
                    onRemove={removeComponent}
                    onMove={moveGridItem}
                    onResize={resizeGridItem}
                    onMetricsChange={setCanvasMetrics}
                  />
                </CanvasDropZone>
                <p className={styles.canvasHint}>
                  Drag from palette to place anywhere. Use item handles to move/resize, arrows to nudge, Shift+arrows to resize.
                </p>
              </CardContent>
            </Card>

            <div className={cn(styles.canvasContent, styles.sideColumn)}>
              {selectedComponent ? (
                <ComponentEditor
                  component={selectedComponent}
                  definition={selectedDefinition}
                  registry={registry}
                  issues={issuesByComponentId.get(selectedComponent.id)}
                  previewData={previewData}
                  previewContext={effectivePreviewContext}
                  translate={i18n.t}
                  onChange={(next) =>
                    setSchema((current) =>
                      withUpdatedComponents(current, (currentComponents) =>
                        currentComponents.map((item) => (item.id === next.id ? next : item)),
                      ),
                    )
                  }
                  onRemove={() => removeComponent(selectedComponent.id)}
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
                schema={effectiveSchema}
                issues={validation.issues}
                resolveComponentId={(path) => extractComponentIdFromIssue(path, components)}
                onFocusComponentId={focusComponent}
                onSchemaChange={(nextSchema) => setSchema(normalizeSchema(nextSchema))}
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
