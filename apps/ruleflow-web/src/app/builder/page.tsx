'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ExecutionContext,
  FlowSchema,
  JSONValue,
  LayoutBreakpoint,
  UIComponent,
  UIGridItem,
  UISchema,
} from '@platform/schema';
import { validateUISchema, type ValidationIssue } from '@platform/validator';
import { RenderPage } from '@platform/react-renderer';
import type { ComponentDefinition } from '@platform/component-registry';
import { builtinComponentDefinitions, isPaletteComponentEnabled } from '@platform/component-registry';
import { createProviderFromBundles, EXAMPLE_TENANT_BUNDLES, PLATFORM_BUNDLES } from '@platform/i18n';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ConfigVersion } from '@/lib/demo/types';
import { apiGet, apiPatch, apiPost } from '@/lib/demo/api-client';
import { useRuntimeFlags } from '@/lib/use-runtime-flags';
import { useRuntimeAdapters } from '@/lib/use-runtime-adapters';
import {
  normalizeUiPages,
  rebindFlowSchemaToAvailablePages,
} from '@/lib/demo/ui-pages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ComponentEditor } from '@/components/builder/component-editor';
import { SchemaPreview } from '@/components/builder/schema-preview';
import { GridCanvas, type CanvasInteraction, type GridCanvasMetrics } from '@/components/builder/grid-canvas';
import { BuilderShell } from '@/components/builder/BuilderShell';
import {
  clampGridRect,
  clampNumber,
  clientToLogicalPoint,
  maxRowsFromArtboard,
} from '@/components/builder/canvas-coordinates';
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
  adapterPrefixFromHint,
} from '@/lib/runtime-adapters';
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
    adapterHint: 'platform.textField',
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

type TemplateSummary = {
  id: string;
  name: string;
  category: string;
  purpose: string;
  requiredData: string[];
  components: string[];
  customizable: string[];
  setupChecklist: string[];
  screenshotTone: 'orders' | 'profile' | 'files' | 'messages';
};

type GetTemplateResponse =
  | { ok: true; template: { summary: TemplateSummary; schema: UISchema } }
  | { ok: false; error: string };

type BuilderDraftState = {
  uiSchemasById?: Record<string, UISchema>;
  activeUiPageId?: string;
  flowSchema?: FlowSchema | null;
};

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
  orders: {
    count: 3,
    filters: {
      search: 'ACME',
      status: 'processing',
      category: 'standard',
      customer: 'enterprise',
    },
    pagination: { page: 1, count: 12 },
    rightPanelItems: ['SLA: 99.9%', 'Owner: Ops Team', 'Updated: 2m ago'],
    items: [
      {
        id: 'ord-1',
        invoice: 'INV-2301',
        date: '2026-01-02',
        status: 'Processing',
        customerName: 'ACME Corp',
        customerEmail: 'ops@acme.com',
        total: '$1,240.00',
      },
      {
        id: 'ord-2',
        invoice: 'INV-2302',
        date: '2026-01-04',
        status: 'Completed',
        customerName: 'Northwind',
        customerEmail: 'finance@northwind.com',
        total: '$980.00',
      },
      {
        id: 'ord-3',
        invoice: 'INV-2303',
        date: '2026-01-06',
        status: 'New',
        customerName: 'Globex',
        customerEmail: 'orders@globex.com',
        total: '$2,420.00',
      },
    ],
  },
  userProfile: {
    activeTab: 'settings',
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@example.com',
    role: 'author',
    bio: 'Product operations analyst focused on onboarding and policy updates.',
    sections: [
      { title: 'Team', description: 'Risk Operations' },
      { title: 'Plan', description: 'Enterprise Pro' },
      { title: 'Billing', description: 'Quarterly invoice' },
    ],
  },
  files: {
    count: 2,
    filters: { tag: 'all' },
    selectedFileName: 'Q1-financial-summary.pdf',
    rightPanelItems: ['Storage: 76%', 'Retention: 180 days', 'Policy: Standard'],
    folders: [
      { id: 'folder-1', name: 'Contracts', modifiedAt: '2026-01-12', size: '128 MB', owner: 'Legal Team' },
      { id: 'folder-2', name: 'Financials', modifiedAt: '2026-01-14', size: '96 MB', owner: 'Finance Team' },
    ],
    tiles: [
      { title: 'Q1-financial-summary.pdf', description: 'Finance / 2.4 MB / Updated today' },
      { title: 'renewal-checklist.docx', description: 'Legal / 840 KB / Updated yesterday' },
      { title: 'customer-onboarding.pptx', description: 'Ops / 1.9 MB / Updated 3 days ago' },
    ],
  },
  messages: {
    count: 4,
    unreadCount: 6,
    composer: '',
    rightPanelItems: ['Channel: Customer Ops', 'SLA: 1h', 'Region: US-East'],
    conversations: [
      { id: 'conv-1', contact: 'Alex Morgan', lastMessage: 'Need status update', time: '09:12' },
      { id: 'conv-2', contact: 'Support Queue', lastMessage: '5 pending escalations', time: '08:45' },
      { id: 'conv-3', contact: 'Finance Team', lastMessage: 'Invoice approved', time: 'Yesterday' },
    ],
    thread: [
      { title: 'Alex Morgan', description: 'Can we confirm delivery ETA for INV-2303?' },
      { title: 'You', description: 'Yes, it is scheduled for tomorrow morning.' },
      { title: 'Alex Morgan', description: 'Great, thank you for confirming.' },
    ],
  },
  navigation: {
    ordersSidebar: ['Orders', 'Returns', 'Invoices', 'Customers'],
    profileSidebar: ['Profile', 'Security', 'Notifications', 'Preferences'],
    filesSidebar: ['Browse', 'Shared', 'Tags', 'Archive'],
    messagingSidebar: ['Inbox', 'Assigned', 'Archived', 'Announcements'],
  },
  revenueSeries: [2, 7, 4, 9],
};

const BUILTIN_COMPONENT_DEFS = builtinComponentDefinitions();
const DEFAULT_ADAPTER_HINT = BUILTIN_COMPONENT_DEFS[0]?.adapterHint ?? 'platform.textField';

type ArtboardPresetId =
  | 'desktop-1440'
  | 'desktop-1600'
  | 'desktop-1920'
  | 'tablet-1024'
  | 'mobile-375'
  | 'custom';

type ArtboardPreset = {
  id: ArtboardPresetId;
  label: string;
  width: number;
  height: number;
};

const ARTBOARD_PRESETS: ArtboardPreset[] = [
  { id: 'desktop-1440', label: 'Desktop 1440 x 900', width: 1440, height: 900 },
  { id: 'desktop-1600', label: 'Desktop 1600 x 1000', width: 1600, height: 1000 },
  { id: 'desktop-1920', label: 'Desktop 1920 x 1080', width: 1920, height: 1080 },
  { id: 'tablet-1024', label: 'Tablet 1024 x 768', width: 1024, height: 768 },
  { id: 'mobile-375', label: 'Mobile 375 x 812', width: 375, height: 812 },
];

function createBuilderFlowSchema(pageId: string): FlowSchema {
  return {
    version: '1.0.0',
    flowId: 'builder-flow',
    initialState: 'start',
    states: {
      start: {
        uiPageId: pageId,
        on: {},
      },
    },
  };
}

function isBuilderDraftState(value: unknown): value is BuilderDraftState {
  if (typeof value !== 'object' || value === null) return false;
  if (isSchemaLike(value)) return false;
  const record = value as BuilderDraftState;
  if (record.activeUiPageId !== undefined && typeof record.activeUiPageId !== 'string') return false;
  if (record.uiSchemasById !== undefined && (typeof record.uiSchemasById !== 'object' || record.uiSchemasById === null)) return false;
  if (record.flowSchema !== undefined && record.flowSchema !== null && typeof record.flowSchema !== 'object') return false;
  return true;
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

function normalizePageId(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'page';
}

function nextPageId(base: string, existing: Set<string>): string {
  const cleaned = normalizePageId(base);
  if (!existing.has(cleaned)) return cleaned;
  let n = 2;
  while (existing.has(`${cleaned}-${n}`)) n += 1;
  return `${cleaned}-${n}`;
}

function normalizeStateId(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'state';
}

function toTestIdSuffix(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function isDefinitionEnabledByRuntimeFlags(
  definition: ComponentDefinition,
  input: {
    allowPlanned: boolean;
    allowExternal: boolean;
    enabledExternalAdapterPrefixes: Iterable<string>;
  },
): boolean {
  const availability = definition.availability ?? (definition.status === 'planned' ? 'planned' : 'implemented');
  if (availability === 'planned') {
    return input.allowPlanned;
  }
  if (availability === 'external') {
    if (!input.allowExternal) return false;
    const enabledPrefixes = new Set(input.enabledExternalAdapterPrefixes);
    return enabledPrefixes.has(adapterPrefixFromHint(definition.adapterHint));
  }
  return true;
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
  const availability = def.availability ?? (def.status === 'planned' ? 'planned' : 'implemented');
  const planned = availability === 'planned';
  const disabledReason = def.palette?.reason ?? 'Not available yet';
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
      data-availability={availability}
      className={`${styles.paletteButton} ${selected ? styles.paletteButtonActive : ''}`}
      onClick={onSelect}
      disabled={disabled}
      title={planned ? disabledReason : undefined}
      {...attributes}
      {...listeners}
    >
      <span>{def.displayName}</span>
      <Badge variant="muted">{def.adapterHint}</Badge>
      {planned ? <Badge variant="warning">{disabledReason}</Badge> : null}
    </button>
  );
}

function initialChecklistState(summary: TemplateSummary | null): Record<string, boolean> {
  if (!summary) return {};
  return Object.fromEntries(summary.setupChecklist.map((_, index) => [`step-${index}`, false]));
}

export default function BuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const versionId = searchParams.get('versionId');
  const previewFromUrl = searchParams.get('preview');
  const templateId = searchParams.get('template');
  const checklistFromUrl = searchParams.get('checklist') === '1';
  const { toast } = useToast();
  const { completeStep, setActiveVersionId } = useOnboarding();

  const [loading, setLoading] = useState(Boolean(versionId));
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registry, setRegistry] = useState<ComponentDefinition[]>(() => BUILTIN_COMPONENT_DEFS);
  const [showPlannedComponents, setShowPlannedComponents] = useState(false);
  const [replaceTargetComponentId, setReplaceTargetComponentId] = useState<string | null>(null);
  const [replacementAdapterHint, setReplacementAdapterHint] = useState('');
  const [loadedVersion, setLoadedVersion] = useState<ConfigVersion | null>(null);
  const [templateSummary, setTemplateSummary] = useState<TemplateSummary | null>(null);
  const [setupChecklistOpen, setSetupChecklistOpen] = useState(checklistFromUrl);
  const [setupChecklistState, setSetupChecklistState] = useState<Record<string, boolean>>({});
  const [templateApplying, setTemplateApplying] = useState(false);
  const [newUiPageDraft, setNewUiPageDraft] = useState('page-2');
  const [newFlowStateDraft, setNewFlowStateDraft] = useState('');
  const appliedTemplateRef = useRef<string | null>(null);
  const [dragReady, setDragReady] = useState(false);
  const [schema, setSchema] = useState<UISchema>(() =>
    versionId ? createSchemaFromComponents([]) : createSchemaFromComponents(scratchComponents),
  );
  const [uiSchemasById, setUiSchemasById] = useState<Record<string, UISchema>>(() =>
    versionId ? {} : { [schema.pageId]: schema },
  );
  const [selectedUiPageId, setSelectedUiPageId] = useState<string>(() =>
    versionId ? 'builder-preview' : schema.pageId,
  );
  const [flowSchemaDraft, setFlowSchemaDraft] = useState<FlowSchema | null>(() =>
    versionId ? null : createBuilderFlowSchema(schema.pageId),
  );
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(() =>
    versionId ? null : scratchComponents[0]?.id ?? null,
  );
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<ExecutionContext['device']>('desktop');
  const [previewLocale, setPreviewLocale] = useState(previewContext.locale);
  const [activeBreakpoint, setActiveBreakpoint] = useState<LayoutBreakpoint>('lg');
  const [showGridOverlay, setShowGridOverlay] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [showMarginGuides, setShowMarginGuides] = useState(true);
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [artboardPreset, setArtboardPreset] = useState<ArtboardPresetId>('desktop-1440');
  const [customArtboardWidth, setCustomArtboardWidth] = useState(1440);
  const [customArtboardHeight, setCustomArtboardHeight] = useState(900);
  const [draft, setDraft] = useState({
    id: '',
    adapterHint: DEFAULT_ADAPTER_HINT,
  });
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const [canvasInteraction, setCanvasInteraction] = useState<CanvasInteraction | null>(null);
  const [canvasMetrics, setCanvasMetrics] = useState<GridCanvasMetrics>({
    cellWidth: 96,
    colStep: 108,
    rowStep: 68,
    rowHeight: 56,
    gap: 12,
    surfaceRect: null,
    viewportRect: null,
    zoom: 1,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeDrag, setActiveDrag] = useState<{ kind: 'palette'; label: string } | null>(null);

  const components = useMemo(() => normalizeFocusOrder(schema.components as UIComponent[]), [schema.components]);
  const effectiveSchema = useMemo(
    () =>
      normalizeSchema({
        ...schema,
        components,
      }),
    [components, schema],
  );
  const normalizedUiPages = useMemo(
    () =>
      normalizeUiPages({
        uiSchema: effectiveSchema,
        uiSchemasById: {
          ...uiSchemasById,
          [selectedUiPageId]: effectiveSchema,
        },
        activeUiPageId: selectedUiPageId,
        flowSchema: flowSchemaDraft,
      }),
    [effectiveSchema, flowSchemaDraft, selectedUiPageId, uiSchemasById],
  );
  const effectiveUiSchemasById = normalizedUiPages.uiSchemasById;
  const uiPageIds = useMemo(() => Object.keys(effectiveUiSchemasById), [effectiveUiSchemasById]);
  const effectiveFlowSchema = useMemo(
    () =>
      rebindFlowSchemaToAvailablePages(
        flowSchemaDraft ?? createBuilderFlowSchema(selectedUiPageId),
        effectiveUiSchemasById,
        selectedUiPageId,
      ) ?? createBuilderFlowSchema(selectedUiPageId),
    [effectiveUiSchemasById, flowSchemaDraft, selectedUiPageId],
  );
  const flowStateEntries = useMemo(
    () => Object.entries(effectiveFlowSchema.states),
    [effectiveFlowSchema],
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
  const artboardSize = useMemo(() => {
    if (artboardPreset === 'custom') {
      return {
        width: clampValue(Math.trunc(customArtboardWidth || 1440), 320, 3200),
        height: clampValue(Math.trunc(customArtboardHeight || 900), 320, 2400),
      };
    }
    const preset = ARTBOARD_PRESETS.find((item) => item.id === artboardPreset) ?? ARTBOARD_PRESETS[0]!;
    return { width: preset.width, height: preset.height };
  }, [artboardPreset, customArtboardHeight, customArtboardWidth]);
  const artboardRows = useMemo(
    () => maxRowsFromArtboard(artboardSize.height, activeGridSpec.rowHeight, activeGridSpec.gap),
    [activeGridSpec.gap, activeGridSpec.rowHeight, artboardSize.height],
  );
  const localStorageKey = useMemo(
    () => `${BUILDER_LOCAL_STORAGE_KEY}:${versionId ?? 'scratch'}`,
    [versionId],
  );
  const runtimeFlags = useRuntimeFlags({
    env: 'prod',
    versionId: versionId ?? undefined,
    packageId: loadedVersion?.packageId,
  });
  const runtimeAdapters = useRuntimeAdapters({
    env: 'prod',
    versionId: versionId ?? undefined,
    packageId: loadedVersion?.packageId,
  });
  const enabledAdapterPrefixes = runtimeAdapters.enabledAdapterPrefixes;
  const enabledExternalAdapterPrefixes = runtimeAdapters.enabledExternalAdapterPrefixes;
  const hasEnabledExternalAdapters = enabledExternalAdapterPrefixes.length > 0;
  const allowPlannedByFlag = runtimeFlags.featureFlags['builder.palette.showPlanned'] ?? true;
  const allowExternalByFlag =
    (runtimeFlags.featureFlags['builder.palette.externalAdapters'] ?? true) &&
    hasEnabledExternalAdapters;
  const killSwitchActive = Boolean(versionId && runtimeFlags.killSwitch.active);
  const killSwitchReason =
    runtimeFlags.killSwitch.reason ?? 'This version is disabled by an active kill switch.';

  useEffect(() => {
    setDragReady(true);
  }, []);

  useEffect(() => {
    const onReplaceRequest = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ componentId?: string; adapterHint?: string }>;
      const componentId = event.detail?.componentId;
      if (!componentId) return;
      setSelectedComponentId(componentId);
      setReplaceTargetComponentId(componentId);
      toast({
        variant: 'info',
        title: 'Choose a replacement',
        description: 'Pick a supported component in the inspector and apply replacement.',
      });
    };

    window.addEventListener('ruleflow:replace-component-request', onReplaceRequest as EventListener);
    return () => {
      window.removeEventListener('ruleflow:replace-component-request', onReplaceRequest as EventListener);
    };
  }, [toast]);

  useEffect(() => {
    if (previewFromUrl === '1') setPreviewMode(true);
  }, [previewFromUrl]);

  useEffect(() => {
    if (!checklistFromUrl) return;
    setSetupChecklistOpen(true);
  }, [checklistFromUrl]);

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
      if (isSchemaLike(parsed)) {
        const normalizedLegacySchema = normalizeSchema(parsed);
        const pageId = normalizedLegacySchema.pageId;
        setUiSchemasById({ [pageId]: normalizedLegacySchema });
        setSelectedUiPageId(pageId);
        setSchema(normalizedLegacySchema);
        setFlowSchemaDraft(createBuilderFlowSchema(pageId));
        setSelectedComponentId((normalizedLegacySchema.components as UIComponent[])[0]?.id ?? null);
        return;
      }
      if (!isBuilderDraftState(parsed)) return;

      const normalizedPages = normalizeUiPages({
        uiSchemasById: parsed.uiSchemasById,
        activeUiPageId: parsed.activeUiPageId,
        flowSchema: parsed.flowSchema,
      });
      const nextPageId =
        normalizedPages.activeUiPageId ||
        Object.keys(normalizedPages.uiSchemasById)[0] ||
        createSchemaFromComponents(scratchComponents).pageId;
      const nextSchema = normalizeSchema(
        normalizedPages.uiSchemasById[nextPageId] ?? createSchemaFromComponents(scratchComponents),
      );
      const reboundFlow = rebindFlowSchemaToAvailablePages(
        parsed.flowSchema ?? createBuilderFlowSchema(nextPageId),
        normalizedPages.uiSchemasById,
        nextPageId,
      );
      setUiSchemasById(normalizedPages.uiSchemasById);
      setSelectedUiPageId(nextPageId);
      setSchema(nextSchema);
      setFlowSchemaDraft(reboundFlow ?? createBuilderFlowSchema(nextPageId));
      setSelectedComponentId((nextSchema.components as UIComponent[])[0]?.id ?? null);
    } catch {
      // ignore bad local state
    }
  }, [localStorageKey, versionId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draftState: BuilderDraftState = {
      uiSchemasById: effectiveUiSchemasById,
      activeUiPageId: selectedUiPageId,
      flowSchema: effectiveFlowSchema,
    };
    window.localStorage.setItem(localStorageKey, JSON.stringify(draftState));
  }, [effectiveFlowSchema, effectiveUiSchemasById, localStorageKey, selectedUiPageId]);

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
      const normalizedPages = normalizeUiPages({
        uiSchema: response.version.bundle.uiSchema,
        uiSchemasById: response.version.bundle.uiSchemasById,
        activeUiPageId: response.version.bundle.activeUiPageId,
        flowSchema: response.version.bundle.flowSchema,
      });
      const nextPageId = normalizedPages.activeUiPageId;
      const normalized = normalizeSchema(
        normalizedPages.uiSchemasById[nextPageId] ?? createSchemaFromComponents(scratchComponents, { pageId: nextPageId }),
      );
      const normalizedComponents = normalized.components as UIComponent[];
      const reboundFlow =
        rebindFlowSchemaToAvailablePages(
          response.version.bundle.flowSchema,
          normalizedPages.uiSchemasById,
          nextPageId,
        ) ?? createBuilderFlowSchema(nextPageId);
      setLoadedVersion(response.version);
      setUiSchemasById(normalizedPages.uiSchemasById);
      setSelectedUiPageId(nextPageId);
      setSchema(normalized);
      setFlowSchemaDraft(reboundFlow);
      setSelectedComponentId(normalizedComponents[0]?.id ?? null);
      setActiveVersionId(versionId);
      toast({ variant: 'info', title: 'Loaded config', description: response.version.version });
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load config', description: error instanceof Error ? error.message : String(error) });
      const fallback = createSchemaFromComponents(scratchComponents);
      setLoadedVersion(null);
      setUiSchemasById({ [fallback.pageId]: fallback });
      setSelectedUiPageId(fallback.pageId);
      setSchema(fallback);
      setFlowSchemaDraft(createBuilderFlowSchema(fallback.pageId));
      setSelectedComponentId((fallback.components as UIComponent[])[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFromStore();
  }, [versionId]);

  useEffect(() => {
    if (!templateId) return;
    if (appliedTemplateRef.current === templateId) return;
    if (templateApplying) return;
    if (versionId && loading) return;

    let cancelled = false;
    const applyTemplate = async () => {
      setTemplateApplying(true);
      try {
        const response = await apiGet<GetTemplateResponse>(`/api/templates/${encodeURIComponent(templateId)}`);
        if (!response.ok) throw new Error(response.error);
        if (cancelled) return;

        const scratchIds = scratchComponents.map((component) => component.id);
        const hasDefaultScratch =
          !versionId &&
          components.length === scratchIds.length &&
          components.every((component) => scratchIds.includes(component.id));

        if (!hasDefaultScratch && components.length > 0) {
          const confirmed = window.confirm(
            `Load "${response.template.summary.name}" and replace the current canvas?`,
          );
          if (!confirmed) {
            return;
          }
        }

        const normalized = normalizeSchema(response.template.schema as UISchema);
        const normalizedComponents = normalized.components as UIComponent[];
        const nextPages: Record<string, UISchema> = { [normalized.pageId]: normalized };
        const nextFlow =
          rebindFlowSchemaToAvailablePages(
            flowSchemaDraft ?? createBuilderFlowSchema(normalized.pageId),
            nextPages,
            normalized.pageId,
          ) ?? createBuilderFlowSchema(normalized.pageId);

        setUiSchemasById(nextPages);
        setSelectedUiPageId(normalized.pageId);
        setSchema(normalized);
        setFlowSchemaDraft(nextFlow);
        setSelectedComponentId(normalizedComponents[0]?.id ?? null);
        setTemplateSummary(response.template.summary);
        setSetupChecklistState(initialChecklistState(response.template.summary));
        setSetupChecklistOpen(true);
        setPreviewMode(false);
        appliedTemplateRef.current = templateId;
        toast({
          variant: 'success',
          title: 'Template applied',
          description: response.template.summary.name,
        });
      } catch (error) {
        if (cancelled) return;
        toast({
          variant: 'error',
          title: 'Template load failed',
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) {
          const next = new URLSearchParams(searchParams.toString());
          next.delete('template');
          next.delete('checklist');
          const query = next.toString();
          router.replace(query ? `/builder?${query}` : '/builder');
          setTemplateApplying(false);
        }
      }
    };

    void applyTemplate();
    return () => {
      cancelled = true;
    };
  }, [components, flowSchemaDraft, loading, router, searchParams, templateApplying, templateId, toast, versionId]);

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
    if (
      !isDefinitionEnabledByRuntimeFlags(def, {
        allowPlanned: allowPlannedByFlag,
        allowExternal: allowExternalByFlag,
        enabledExternalAdapterPrefixes,
      }) ||
      !isPaletteComponentEnabled(def, { enabledAdapterPrefixes })
    ) {
      toast({
        variant: 'error',
        title: 'Component unavailable',
        description: def.palette?.reason ?? 'This component is planned and not available yet.',
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
    if (killSwitchActive) {
      toast({
        variant: 'error',
        title: 'Save blocked by kill switch',
        description: killSwitchReason,
      });
      return;
    }

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
          uiSchemasById: effectiveUiSchemasById,
          activeUiPageId: selectedUiPageId,
          flowSchema: effectiveFlowSchema,
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
    if (killSwitchActive) {
      toast({
        variant: 'error',
        title: 'Submit blocked by kill switch',
        description: killSwitchReason,
      });
      return;
    }
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

  const commitPages = (
    nextPages: Record<string, UISchema>,
    nextPageId: string,
    flowOverride?: FlowSchema | null,
  ) => {
    const normalizedPages = normalizeUiPages({
      uiSchemasById: nextPages,
      activeUiPageId: nextPageId,
      flowSchema: flowOverride ?? effectiveFlowSchema,
    });
    const resolvedPageId = normalizedPages.activeUiPageId;
    const nextSchema = normalizeSchema(
      normalizedPages.uiSchemasById[resolvedPageId] ??
        createSchemaFromComponents([], { pageId: resolvedPageId }),
    );
    const reboundFlow =
      rebindFlowSchemaToAvailablePages(
        flowOverride ?? effectiveFlowSchema,
        normalizedPages.uiSchemasById,
        resolvedPageId,
      ) ?? createBuilderFlowSchema(resolvedPageId);

    setUiSchemasById(normalizedPages.uiSchemasById);
    setSelectedUiPageId(resolvedPageId);
    setSchema(nextSchema);
    setFlowSchemaDraft(reboundFlow);
    setSelectedComponentId((nextSchema.components as UIComponent[])[0]?.id ?? null);
  };

  const switchUiPage = (pageId: string) => {
    if (!effectiveUiSchemasById[pageId]) return;
    commitPages(effectiveUiSchemasById, pageId);
  };

  const addUiPage = () => {
    const existing = new Set(uiPageIds);
    const requested = newUiPageDraft.trim() || `page-${uiPageIds.length + 1}`;
    const pageId = nextPageId(requested, existing);
    const pageSchema = createSchemaFromComponents([], {
      pageId,
      version: effectiveSchema.version,
      columns: activeGridSpec.columns,
    });
    const nextPages = {
      ...effectiveUiSchemasById,
      [pageId]: pageSchema,
    };
    commitPages(nextPages, pageId);
    setNewUiPageDraft(`page-${Object.keys(nextPages).length + 1}`);
    toast({ variant: 'success', title: 'Page added', description: pageId });
  };

  const duplicateUiPage = () => {
    const source = effectiveUiSchemasById[selectedUiPageId];
    if (!source) return;
    const existing = new Set(uiPageIds);
    const pageId = nextPageId(`${selectedUiPageId}-copy`, existing);
    const duplicated = normalizeSchema({
      ...deepCloneJson(source),
      pageId,
    });
    const nextPages = {
      ...effectiveUiSchemasById,
      [pageId]: duplicated,
    };
    commitPages(nextPages, pageId);
    toast({ variant: 'success', title: 'Page duplicated', description: `${selectedUiPageId} -> ${pageId}` });
  };

  const deleteUiPage = () => {
    if (uiPageIds.length <= 1) {
      toast({ variant: 'error', title: 'At least one page is required' });
      return;
    }
    const nextPages = { ...effectiveUiSchemasById };
    delete nextPages[selectedUiPageId];
    const fallbackPageId = Object.keys(nextPages)[0];
    if (!fallbackPageId) return;
    commitPages(nextPages, fallbackPageId);
    toast({ variant: 'info', title: 'Page deleted', description: selectedUiPageId });
  };

  const addFlowState = () => {
    const existing = new Set(Object.keys(effectiveFlowSchema.states));
    const requested = normalizeStateId(newFlowStateDraft || `state_${existing.size + 1}`);
    let stateId = requested;
    let index = 2;
    while (existing.has(stateId)) {
      stateId = `${requested}_${index}`;
      index += 1;
    }
    const nextFlow: FlowSchema = {
      ...effectiveFlowSchema,
      states: {
        ...effectiveFlowSchema.states,
        [stateId]: {
          uiPageId: selectedUiPageId,
          on: {},
        },
      },
    };
    setFlowSchemaDraft(nextFlow);
    setNewFlowStateDraft('');
    toast({ variant: 'success', title: 'Flow state added', description: stateId });
  };

  const updateFlowStatePage = (stateId: string, pageId: string) => {
    if (!effectiveFlowSchema.states[stateId]) return;
    setFlowSchemaDraft({
      ...effectiveFlowSchema,
      states: {
        ...effectiveFlowSchema.states,
        [stateId]: {
          ...effectiveFlowSchema.states[stateId],
          uiPageId: pageId,
        },
      },
    });
  };

  const selectedComponent = selectedComponentId ? components.find((component) => component.id === selectedComponentId) ?? null : null;
  const selectedItem = selectedComponentId
    ? activeItems.find((item) => item.componentId === selectedComponentId) ?? null
    : null;
  const selectedItemIndex = selectedItem
    ? activeItems.findIndex((item) => item.componentId === selectedItem.componentId)
    : -1;
  const selectedDefinition =
    selectedComponent ? registry.find((def) => def.adapterHint === selectedComponent.adapterHint) ?? null : null;
  const visiblePaletteDefinitions = useMemo(
    () =>
      registry.filter(
        (definition) => {
          if (
            !isDefinitionEnabledByRuntimeFlags(definition, {
              allowPlanned: allowPlannedByFlag,
              allowExternal: allowExternalByFlag,
              enabledExternalAdapterPrefixes,
            })
          ) {
            return false;
          }
          if (definition.availability === 'planned') {
            return showPlannedComponents;
          }
          return true;
        },
      ),
    [allowExternalByFlag, allowPlannedByFlag, enabledExternalAdapterPrefixes, registry, showPlannedComponents],
  );
  const supportedReplacementDefinitions = useMemo(
    () =>
      registry.filter(
        (definition) =>
          definition.availability === 'implemented' &&
          isPaletteComponentEnabled(definition, { enabledAdapterPrefixes }),
      ),
    [enabledAdapterPrefixes, registry],
  );
  const replaceTargetComponent = useMemo(
    () =>
      replaceTargetComponentId
        ? components.find((component) => component.id === replaceTargetComponentId) ?? null
        : null,
    [components, replaceTargetComponentId],
  );

  useEffect(() => {
    if (!selectedComponent) return;
    const unsupported =
      !selectedDefinition ||
      selectedDefinition.availability === 'planned' ||
      !isPaletteComponentEnabled(selectedDefinition, { enabledAdapterPrefixes });
    if (!unsupported) return;
    setReplaceTargetComponentId(selectedComponent.id);
  }, [enabledAdapterPrefixes, selectedComponent, selectedDefinition]);

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

  useEffect(() => {
    if (!replaceTargetComponent) {
      setReplacementAdapterHint('');
      return;
    }
    setReplacementAdapterHint((current) => {
      if (
        current &&
        supportedReplacementDefinitions.some((definition) => definition.adapterHint === current)
      ) {
        return current;
      }
      return supportedReplacementDefinitions[0]?.adapterHint ?? '';
    });
  }, [replaceTargetComponent, supportedReplacementDefinitions]);

  const applyReplacementComponent = () => {
    if (!replaceTargetComponent || !replacementAdapterHint) return;
    const nextDefinition = supportedReplacementDefinitions.find(
      (definition) => definition.adapterHint === replacementAdapterHint,
    );
    if (!nextDefinition) return;

    setSchema((current) =>
      withUpdatedComponents(current, (currentComponents) =>
        currentComponents.map((component) => {
          if (component.id !== replaceTargetComponent.id) return component;
          return {
            ...component,
            type: deriveType(nextDefinition.adapterHint),
            adapterHint: nextDefinition.adapterHint,
            props: nextDefinition.defaultProps
              ? stripRawI18nProps(deepCloneJson(nextDefinition.defaultProps))
              : component.props,
          };
        }),
      ),
    );
    setReplaceTargetComponentId(null);
    toast({
      variant: 'success',
      title: 'Component replaced',
      description: `${replaceTargetComponent.id} now uses ${nextDefinition.displayName}.`,
    });
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
    options?: {
      anchorId?: string;
      useCollision?: boolean;
    },
  ) => {
    setSchema((current) => {
      const normalized = normalizeSchema(current);
      const spec = getSchemaGridSpec(normalized);
      const currentItems = getSchemaItemsForBreakpoint(normalized, breakpoint);
      const nextItems = updater(currentItems).map((item) => ({
        ...item,
        ...clampGridRect(
          { x: item.x, y: item.y, w: item.w, h: item.h },
          breakpoint === 'lg'
            ? spec.columns
            : spec.breakpoints?.[breakpoint]?.columns ?? spec.columns,
          artboardRows,
        ),
      }));
      const useCollision = options?.useCollision ?? true;
      const resolved =
        useCollision && options?.anchorId
          ? resolveCollisions(
              nextItems,
              options.anchorId,
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

  const updateGridItemLayout = (
    componentId: string,
    nextRect: Partial<Pick<UIGridItem, 'x' | 'y' | 'w' | 'h' | 'layer'>>,
    options?: { useCollision?: boolean },
  ) => {
    updateGridItems(
      activeBreakpoint,
      (items) =>
        items.map((item) => {
          if (item.componentId !== componentId) return item;
          const next = {
            ...item,
            ...nextRect,
          };
          const bounded = clampGridRect(
            { x: next.x, y: next.y, w: next.w, h: next.h },
            activeGridSpec.columns,
            artboardRows,
          );
          return {
            ...next,
            ...bounded,
            layer:
              typeof next.layer === 'number'
                ? Math.max(0, Math.trunc(next.layer))
                : undefined,
          };
        }),
      {
        anchorId: componentId,
        useCollision: options?.useCollision ?? true,
      },
    );
  };

  const alignSelected = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedItem) return;
    const current = selectedItem;
    if (alignment === 'left') {
      updateGridItemLayout(current.componentId, { x: 0 });
      return;
    }
    if (alignment === 'center') {
      const x = Math.max(0, Math.round((activeGridSpec.columns - current.w) / 2));
      updateGridItemLayout(current.componentId, { x });
      return;
    }
    if (alignment === 'right') {
      const x = Math.max(0, activeGridSpec.columns - current.w);
      updateGridItemLayout(current.componentId, { x });
      return;
    }
    if (alignment === 'top') {
      updateGridItemLayout(current.componentId, { y: 0 });
      return;
    }
    if (alignment === 'middle') {
      const y = Math.max(0, Math.round((artboardRows - current.h) / 2));
      updateGridItemLayout(current.componentId, { y });
      return;
    }
    const y = Math.max(0, artboardRows - current.h);
    updateGridItemLayout(current.componentId, { y });
  };

  const distributeItems = (direction: 'horizontal' | 'vertical') => {
    if (activeItems.length < 3) return;
    updateGridItems(
      activeBreakpoint,
      (items) => {
        const sorted = [...items].sort((a, b) =>
          direction === 'horizontal'
            ? a.x - b.x || a.componentId.localeCompare(b.componentId)
            : a.y - b.y || a.componentId.localeCompare(b.componentId),
        );
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        if (!first || !last) return items;
        if (direction === 'horizontal') {
          const span = last.x - first.x;
          if (span <= 0) return items;
          return sorted.map((item, index) => {
            if (index === 0 || index === sorted.length - 1) return item;
            const nextX = Math.round(first.x + (span * index) / (sorted.length - 1));
            return {
              ...item,
              x: clampNumber(nextX, 0, Math.max(0, activeGridSpec.columns - item.w)),
            };
          });
        }
        const span = last.y - first.y;
        if (span <= 0) return items;
        return sorted.map((item, index) => {
          if (index === 0 || index === sorted.length - 1) return item;
          const nextY = Math.round(first.y + (span * index) / (sorted.length - 1));
          return {
            ...item,
            y: clampNumber(nextY, 0, Math.max(0, artboardRows - item.h)),
          };
        });
      },
      { useCollision: false },
    );
  };

  const changeSelectedLayer = (direction: 'forward' | 'backward') => {
    if (!selectedItem) return;
    const baseline = typeof selectedItem.layer === 'number' ? selectedItem.layer : Math.max(0, selectedItemIndex);
    const nextLayer = direction === 'forward' ? baseline + 1 : Math.max(0, baseline - 1);
    updateGridItemLayout(selectedItem.componentId, { layer: nextLayer }, { useCollision: false });
  };

  const resetSelectedSize = () => {
    if (!selectedItem) return;
    updateGridItemLayout(selectedItem.componentId, { w: 4, h: 3 });
  };

  const alignSelectedToGrid = () => {
    if (!selectedItem) return;
    updateGridItemLayout(
      selectedItem.componentId,
      {
        x: Math.round(selectedItem.x),
        y: Math.round(selectedItem.y),
        w: Math.max(1, Math.round(selectedItem.w)),
        h: Math.max(1, Math.round(selectedItem.h)),
      },
      { useCollision: true },
    );
  };

  const fitSelectedToContent = () => {
    if (!selectedItem || !selectedComponent) return;
    const hint = selectedComponent.adapterHint.toLowerCase();
    const isLarge =
      hint.includes('table') ||
      hint.includes('chart') ||
      hint.includes('calendar') ||
      hint.includes('drawer');
    const nextW = isLarge ? Math.min(activeGridSpec.columns, 8) : Math.min(activeGridSpec.columns, 4);
    const nextH = isLarge ? 6 : 3;
    updateGridItemLayout(selectedItem.componentId, { w: nextW, h: nextH });
  };

  const zoomToFit = () => {
    const viewport = canvasMetrics.viewportRect;
    if (!viewport) return;
    const availableWidth = Math.max(320, viewport.width - 120);
    const availableHeight = Math.max(280, viewport.height - 120);
    const widthRatio = availableWidth / artboardSize.width;
    const heightRatio = availableHeight / artboardSize.height;
    const nextZoom = clampValue(Math.round(Math.min(widthRatio, heightRatio) * 100), 50, 200);
    setZoomPercent(nextZoom);
  };

  const zoomToSelection = () => {
    if (!selectedItem) return;
    const viewport = canvasMetrics.viewportRect;
    if (!viewport) return;
    const widthPx = selectedItem.w * canvasMetrics.colStep - canvasMetrics.gap;
    const heightPx = selectedItem.h * canvasMetrics.rowStep - canvasMetrics.gap;
    const availableWidth = Math.max(120, viewport.width - 160);
    const availableHeight = Math.max(120, viewport.height - 160);
    const widthRatio = availableWidth / Math.max(80, widthPx);
    const heightRatio = availableHeight / Math.max(80, heightPx);
    const nextZoom = clampValue(Math.round(Math.min(widthRatio, heightRatio) * 100), 50, 200);
    setZoomPercent(nextZoom);
  };

  const removeComponent = (componentId: string) => {
    setSchema((current) => removeComponentFromSchema(current, componentId));
    toast({ variant: 'info', title: 'Component removed', description: componentId });
  };

  const onDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (!activeId.startsWith('palette:')) return;
    setActiveDrag({ kind: 'palette', label: String(event.active.data.current?.label ?? 'Palette item') });
  };

  const onDragMove = (event: DragMoveEvent) => {
    if (!String(event.active.id).startsWith('palette:')) return;
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
    if (activeId.startsWith('palette:')) {
      const adapterHint = activeId.slice('palette:'.length);
      const def = registry.find((item) => item.adapterHint === adapterHint);
      if (!def) return;
      if (
        !isDefinitionEnabledByRuntimeFlags(def, {
          allowPlanned: allowPlannedByFlag,
          allowExternal: allowExternalByFlag,
          enabledExternalAdapterPrefixes,
        }) ||
        !isPaletteComponentEnabled(def, { enabledAdapterPrefixes })
      ) {
        toast({
          variant: 'error',
          title: 'Component unavailable',
          description: def.palette?.reason ?? 'This component is planned and not available yet.',
        });
        return;
      }

      const existingIds = new Set(components.map((component) => component.id));
      const base = deriveType(adapterHint);
      const id = nextId(base, existingIds);
      const nextComponent = buildComponentFromRegistry(def, id);
      setSchema((current) => withUpdatedComponents(current, (currentComponents) => [...currentComponents, nextComponent]));

      const rect = canvasMetrics.surfaceRect;
      const pointer = dragPointer;
      if (rect && pointer) {
        const logical = clientToLogicalPoint(pointer.x, pointer.y, rect, canvasMetrics.zoom);
        const rawX = Math.floor(logical.x / canvasMetrics.colStep);
        const rawY = Math.floor(logical.y / canvasMetrics.rowStep);
        updateGridItemLayout(
          id,
          {
            x: clampNumber(rawX, 0, Math.max(0, activeGridSpec.columns - 1)),
            y: clampNumber(rawY, 0, Math.max(0, artboardRows - 1)),
            layer: Math.max(0, activeItems.length),
          },
          { useCollision: true },
        );
      }
      setSelectedComponentId(id);
      toast({ variant: 'success', title: 'Dropped component', description: id });
    }
  };

  const dragGridCoordinates = useMemo(() => {
    const rect = canvasMetrics.surfaceRect;
    if (!dragPointer || !rect) return null;
    const logical = clientToLogicalPoint(dragPointer.x, dragPointer.y, rect, canvasMetrics.zoom);
    const x = Math.max(0, Math.floor(logical.x / canvasMetrics.colStep));
    const y = Math.max(0, Math.floor(logical.y / canvasMetrics.rowStep));
    return { x, y };
  }, [canvasMetrics, dragPointer]);

  return (
    <div className={cn(styles.page, styles.builderRoot)}>
      <Card className={styles.headerCard}>
        <CardHeader>
          <div className={styles.headerRow}>
            <div>
              <CardTitle>Schema Builder</CardTitle>
              <p className={styles.subtext}>
                {versionId ? (
                  <>
                    Editing <span className="rfCodeInline">{versionId}</span>
                    {loadedVersion ? ` - ${loadedVersion.status}` : null}
                    {killSwitchActive ? ' - KILLED' : null}
                  </>
                ) : (
                  'Scratch schema (stored in localStorage). Use New Config to persist a package.'
                )}
                {templateSummary ? (
                  <>
                    <br />
                    Template: <span className="rfCodeInline">{templateSummary.name}</span> ({templateSummary.category})
                  </>
                ) : null}
              </p>
            </div>
            <div className={styles.actions}>
              <Button variant="outline" size="sm" onClick={loadFromStore} disabled={!versionId || loading}>
                Reload
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreviewMode((v) => !v)} disabled={loading}>
                {previewMode ? 'Exit preview' : 'Preview'}
              </Button>
              {templateSummary ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSetupChecklistOpen((open) => !open)}
                  disabled={loading || templateApplying}
                  data-testid="builder-template-checklist-toggle"
                >
                  {setupChecklistOpen ? 'Hide setup checklist' : 'Show setup checklist'}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={submitForReview}
                disabled={!versionId || loading || !validation.valid || killSwitchActive}
                title={
                  killSwitchActive
                    ? killSwitchReason
                    : !validation.valid
                      ? 'Fix validation issues before submitting for review'
                      : undefined
                }
              >
                Submit for review
              </Button>
              <Button
                size="sm"
                onClick={saveToStore}
                disabled={loading || !validation.valid || killSwitchActive}
                title={
                  killSwitchActive
                    ? killSwitchReason
                    : !validation.valid
                      ? 'Fix validation issues to enable Save'
                      : undefined
                }
              >
                {loading ? 'Working...' : 'Save'}
              </Button>
            </div>
          </div>
          {killSwitchActive ? (
            <p className={styles.killWarning} data-testid="builder-kill-warning">
              Runtime kill switch is active. Save and submit are disabled. {killSwitchReason}
            </p>
          ) : null}
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
            <label className="rfFieldLabel">UI Page</label>
            <Select
              value={selectedUiPageId}
              onChange={(event) => switchUiPage(event.target.value)}
              data-testid="builder-page-switcher"
            >
              {uiPageIds.map((pageId) => (
                <option key={pageId} value={pageId}>
                  {pageId}
                </option>
              ))}
            </Select>
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
          <div>
            <label className="rfFieldLabel">Page Actions</label>
            <div className={styles.pageActionsRow}>
              <Input
                value={newUiPageDraft}
                onChange={(event) => setNewUiPageDraft(event.target.value)}
                aria-label="New page id"
                data-testid="builder-new-page-id"
              />
              <Button type="button" size="sm" onClick={addUiPage} data-testid="builder-page-add">
                Add page
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={duplicateUiPage} data-testid="builder-page-duplicate">
                Duplicate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={deleteUiPage}
                disabled={uiPageIds.length <= 1}
                data-testid="builder-page-delete"
              >
                Delete
              </Button>
            </div>
          </div>
          <div className={styles.metaSpanAll}>
            <label className="rfFieldLabel">Flow State to Page Binding</label>
            <div className={styles.flowStateGrid} data-testid="builder-flow-state-bindings">
              {flowStateEntries.map(([stateId, state]) => (
                <div key={stateId} className={styles.flowStateRow}>
                  <span className={styles.flowStateName}>{stateId}</span>
                  <Select
                    value={uiPageIds.includes(state.uiPageId) ? state.uiPageId : selectedUiPageId}
                    onChange={(event) => updateFlowStatePage(stateId, event.target.value)}
                    data-testid={`builder-flow-state-page-${toTestIdSuffix(stateId)}`}
                  >
                    {uiPageIds.map((pageId) => (
                      <option key={`${stateId}-${pageId}`} value={pageId}>
                        {pageId}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
              <div className={styles.flowStateCreateRow}>
                <Input
                  value={newFlowStateDraft}
                  onChange={(event) => setNewFlowStateDraft(event.target.value)}
                  placeholder="new_state_id"
                  aria-label="New flow state id"
                  data-testid="builder-flow-state-new-id"
                />
                <Button type="button" size="sm" variant="outline" onClick={addFlowState} data-testid="builder-flow-state-add">
                  Add state
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {dragReady ? (
        <DndContext
          id="builder-dnd-context"
          sensors={sensors}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        >
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
          <BuilderShell
            className={styles.builderShell}
            storageKey={`ruleflow:builder:layout:${effectivePreviewContext.tenantId}`}
            palette={
              <Card className={styles.panelCard}>
                <CardHeader className={styles.panelHeader}>
                  <CardTitle>Component Palette</CardTitle>
                </CardHeader>
                <CardContent className={cn(styles.paletteContent, styles.panelContentScrollable)}>
                  {registryLoading ? <p className={styles.canvasHint}>Loading registry...</p> : null}
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={showPlannedComponents}
                      onChange={(event) => setShowPlannedComponents(Boolean(event.target.checked))}
                      disabled={!allowPlannedByFlag}
                      data-testid="builder-toggle-show-planned"
                    />
                    <span>{allowPlannedByFlag ? 'Show planned components' : 'Planned components disabled by runtime flag'}</span>
                  </label>
                  {!allowExternalByFlag ? (
                    <p className={styles.canvasHint} data-testid="builder-external-palette-disabled">
                      External adapter components are hidden by runtime flag.
                    </p>
                  ) : null}
                  {visiblePaletteDefinitions.map((def) => (
                    <PaletteItem
                      key={def.adapterHint}
                      def={def}
                      selected={draft.adapterHint === def.adapterHint}
                      disabled={
                        loading ||
                        registryLoading ||
                        !isPaletteComponentEnabled(def, { enabledAdapterPrefixes })
                      }
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
            }
            canvasToolbar={
              <div className={styles.workspaceToolbar}>
                <div className={styles.canvasHeaderRow}>
                  <div>
                    <h2 className={styles.workspaceTitle}>Canvas Workspace</h2>
                    <p className={styles.canvasHint}>Drag from palette and place on the grid surface.</p>
                  </div>
                  <div className={styles.actions}>
                    {canvasInteraction ? (
                      <Badge variant="muted">
                        {canvasInteraction.x},{canvasInteraction.y} {canvasInteraction.w}x{canvasInteraction.h} |
                        {' '}
                        {Math.round(canvasInteraction.px.left)}px,
                        {Math.round(canvasInteraction.px.top)}px
                        {' '}
                        {Math.round(canvasInteraction.px.width)}x{Math.round(canvasInteraction.px.height)}px
                      </Badge>
                    ) : dragGridCoordinates ? (
                      <Badge variant="muted">
                        {dragGridCoordinates.x},{dragGridCoordinates.y}
                      </Badge>
                    ) : null}
                    <Badge variant={validation.valid ? 'success' : 'warning'}>
                      {validation.valid ? 'Valid' : `${validation.issues.length} Issues`}
                    </Badge>
                  </div>
                </div>
                <div className={styles.canvasControlsRow}>
                  <div className={styles.canvasControlGroup}>
                    <label className="rfFieldLabel">Artboard</label>
                    <Select
                      value={artboardPreset}
                      onChange={(event) => setArtboardPreset(event.target.value as ArtboardPresetId)}
                      aria-label="Artboard preset"
                      data-testid="builder-artboard-select"
                    >
                      {ARTBOARD_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                      <option value="custom">Custom</option>
                    </Select>
                    {artboardPreset === 'custom' ? (
                      <div className={styles.artboardCustomGrid}>
                        <Input
                          type="number"
                          value={customArtboardWidth}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            setCustomArtboardWidth(Number.isFinite(parsed) ? Math.trunc(parsed) : 1440);
                          }}
                          aria-label="Custom artboard width"
                          data-testid="builder-artboard-custom-width"
                        />
                        <Input
                          type="number"
                          value={customArtboardHeight}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            setCustomArtboardHeight(Number.isFinite(parsed) ? Math.trunc(parsed) : 900);
                          }}
                          aria-label="Custom artboard height"
                          data-testid="builder-artboard-custom-height"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.canvasControlGroup}>
                    <label className="rfFieldLabel">Zoom</label>
                    <div className={styles.zoomControls}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setZoomPercent((current) => clampValue(current - 10, 50, 200))}
                        aria-label="Zoom out"
                      >
                        -
                      </Button>
                      <Input
                        type="number"
                        value={zoomPercent}
                        onChange={(event) => {
                          const parsed = Number(event.target.value);
                          const next = Number.isFinite(parsed) ? Math.trunc(parsed) : 100;
                          setZoomPercent(clampValue(next, 50, 200));
                        }}
                        aria-label="Canvas zoom percent"
                        data-testid="builder-zoom-input"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setZoomPercent((current) => clampValue(current + 10, 50, 200))}
                        aria-label="Zoom in"
                      >
                        +
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setZoomPercent(100)} data-testid="builder-zoom-reset">
                        Reset
                      </Button>
                      <Button variant="outline" size="sm" onClick={zoomToFit} data-testid="builder-zoom-fit">
                        Fit
                      </Button>
                      <Button variant="outline" size="sm" onClick={zoomToSelection} disabled={!selectedItem} data-testid="builder-zoom-selection">
                        Selection
                      </Button>
                    </div>
                  </div>
                  <div className={styles.canvasControlGroup}>
                    <label className="rfFieldLabel">Canvas Helpers</label>
                    <div className={styles.togglePills}>
                      <button
                        type="button"
                        className={cn(styles.togglePill, showGridOverlay ? styles.togglePillActive : undefined)}
                        onClick={() => setShowGridOverlay((value) => !value)}
                        aria-pressed={showGridOverlay}
                        data-testid="builder-toggle-grid"
                      >
                        Grid
                      </button>
                      <button
                        type="button"
                        className={cn(styles.togglePill, snapToGrid ? styles.togglePillActive : undefined)}
                        onClick={() => setSnapToGrid((value) => !value)}
                        aria-pressed={snapToGrid}
                        data-testid="builder-toggle-snap"
                      >
                        Snap
                      </button>
                      <button
                        type="button"
                        className={cn(styles.togglePill, showRulers ? styles.togglePillActive : undefined)}
                        onClick={() => setShowRulers((value) => !value)}
                        aria-pressed={showRulers}
                        data-testid="builder-toggle-rulers"
                      >
                        Rulers
                      </button>
                      <button
                        type="button"
                        className={cn(styles.togglePill, showGuides ? styles.togglePillActive : undefined)}
                        onClick={() => setShowGuides((value) => !value)}
                        aria-pressed={showGuides}
                        data-testid="builder-toggle-guides"
                      >
                        Guides
                      </button>
                      <button
                        type="button"
                        className={cn(styles.togglePill, lockAspectRatio ? styles.togglePillActive : undefined)}
                        onClick={() => setLockAspectRatio((value) => !value)}
                        aria-pressed={lockAspectRatio}
                        data-testid="builder-toggle-aspect"
                      >
                        Lock Aspect
                      </button>
                      <Badge variant="muted">{artboardSize.width}x{artboardSize.height}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            }
            canvas={
              <div className={styles.canvasContent}>
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
                    showRulers={showRulers}
                    showGuides={showGuides}
                    showMarginGuides={showMarginGuides}
                    lockAspectRatio={lockAspectRatio}
                    artboardWidth={artboardSize.width}
                    artboardHeight={artboardSize.height}
                    zoom={zoomPercent}
                    snap={snapToGrid}
                    onSelect={setSelectedComponentId}
                    onRemove={removeComponent}
                    onUpdateLayout={(componentId, next) => updateGridItemLayout(componentId, next)}
                    onInteractionChange={setCanvasInteraction}
                    onMetricsChange={setCanvasMetrics}
                  />
                </CanvasDropZone>
                <p className={styles.canvasHint}>
                  Drag the handle to move, use resize handles for precise sizing, and Shift + arrows to resize by grid units. Canvas scroll is isolated to this center workspace.
                </p>
              </div>
            }
            inspector={
              <div className={styles.inspectorStack}>
                {setupChecklistOpen && templateSummary ? (
                  <Card className={styles.setupChecklistCard} data-testid="builder-template-checklist">
                    <CardHeader>
                      <CardTitle>{templateSummary.name} setup checklist</CardTitle>
                    </CardHeader>
                    <CardContent className={styles.setupChecklistBody}>
                      <p className={styles.canvasHint}>
                        Follow these guided steps: connect data, configure labels, configure rules, preview, then publish.
                      </p>
                      <div className={styles.setupChecklistSteps}>
                        {templateSummary.setupChecklist.map((step, index) => {
                          const key = `step-${index}`;
                          const done = setupChecklistState[key] ?? false;
                          return (
                            <button
                              key={key}
                              type="button"
                              className={cn(styles.setupChecklistStep, done ? styles.setupChecklistStepDone : undefined)}
                              onClick={() =>
                                setSetupChecklistState((current) => ({
                                  ...current,
                                  [key]: !done,
                                }))
                              }
                            >
                              <span className={styles.setupChecklistBullet} aria-hidden="true">
                                {done ? 'x' : index + 1}
                              </span>
                              <span>{step}</span>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {replaceTargetComponent ? (
                  <Card data-testid="builder-replace-component-card">
                    <CardHeader>
                      <CardTitle>Replace Unsupported Component</CardTitle>
                    </CardHeader>
                    <CardContent className={styles.addStack}>
                      <p className={styles.canvasHint}>
                        <code>{replaceTargetComponent.adapterHint}</code> is unavailable. Choose a supported replacement.
                      </p>
                      <Select
                        value={replacementAdapterHint}
                        onChange={(event) => setReplacementAdapterHint(event.target.value)}
                        data-testid="builder-replace-component-select"
                      >
                        {supportedReplacementDefinitions.map((definition) => (
                          <option key={definition.adapterHint} value={definition.adapterHint}>
                            {definition.category} - {definition.displayName} ({definition.adapterHint})
                          </option>
                        ))}
                      </Select>
                      <div className={styles.actions}>
                        <Button
                          type="button"
                          size="sm"
                          onClick={applyReplacementComponent}
                          disabled={!replacementAdapterHint}
                          data-testid="builder-replace-component-apply"
                        >
                          Apply replacement
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setReplaceTargetComponentId(null)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {selectedComponent ? (
                  <ComponentEditor
                    component={selectedComponent}
                    definition={selectedDefinition}
                    registry={registry}
                    issues={issuesByComponentId.get(selectedComponent.id)}
                    previewData={previewData}
                    previewContext={effectivePreviewContext}
                    translate={i18n.t}
                    layout={
                      selectedItem
                        ? {
                            x: selectedItem.x,
                            y: selectedItem.y,
                            w: selectedItem.w,
                            h: selectedItem.h,
                            layer: selectedItem.layer ?? Math.max(0, selectedItemIndex),
                            colStep: canvasMetrics.colStep,
                            rowStep: canvasMetrics.rowStep,
                            gap: activeGridSpec.gap,
                            columns: activeGridSpec.columns,
                            maxRows: artboardRows,
                          }
                        : undefined
                    }
                    onLayoutChange={(patch) => {
                      if (!selectedItem) return;
                      updateGridItemLayout(selectedItem.componentId, patch);
                    }}
                    onAlign={alignSelected}
                    onDistribute={distributeItems}
                    onBringForward={() => changeSelectedLayer('forward')}
                    onSendBackward={() => changeSelectedLayer('backward')}
                    onResetLayoutSize={resetSelectedSize}
                    onAlignToGrid={alignSelectedToGrid}
                    onFitToContent={fitSelectedToContent}
                    onToggleMarginGuides={() => setShowMarginGuides((value) => !value)}
                    marginGuidesEnabled={showMarginGuides}
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
                  onSchemaChange={(nextSchema) =>
                    setSchema(
                      normalizeSchema({
                        ...nextSchema,
                        pageId: selectedUiPageId,
                      }),
                    )
                  }
                />
              </div>
            }
          />
        )}

          <DragOverlay>
            {activeDrag ? (
              <div className={styles.dragOverlay}>
                <div className={styles.dragOverlayTitle}>{activeDrag.label}</div>
                <div className={styles.dragOverlaySub}>Palette item</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card>
          <CardContent>
            <p className={styles.canvasHint}>Preparing drag and drop workspace...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function deriveType(adapterHint: string): string {
  const parts = adapterHint.split('.');
  return parts[parts.length - 1] || adapterHint;
}

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
