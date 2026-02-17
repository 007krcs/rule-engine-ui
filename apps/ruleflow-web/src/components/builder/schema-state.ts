import type {
  LayoutBreakpoint,
  UIComponent,
  UIGridItem,
  UIGridSpec,
  UISchema,
} from '@platform/schema';

type GridLayout = Extract<UISchema['layout'], { type: 'grid' }>;

const DEFAULT_VERSION = '1.0.0';
const DEFAULT_PAGE_ID = 'builder-preview';
const DEFAULT_COLUMNS = 12;
const DEFAULT_ROW_HEIGHT = 56;
const DEFAULT_GAP = 12;
const BREAKPOINTS: LayoutBreakpoint[] = ['lg', 'md', 'sm'];

function cloneComponent(component: UIComponent): UIComponent {
  return JSON.parse(JSON.stringify(component)) as UIComponent;
}

function cloneItem(item: UIGridItem): UIGridItem {
  return JSON.parse(JSON.stringify(item)) as UIGridItem;
}

function normalizeColumns(columns: number | undefined, fallback = DEFAULT_COLUMNS): number {
  if (!Number.isFinite(columns) || !columns) return fallback;
  return Math.max(1, Math.trunc(columns));
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !value) return fallback;
  return Math.max(1, Math.trunc(value));
}

function normalizeBreakpoint(
  value: unknown,
  fallback: LayoutBreakpoint | undefined,
): LayoutBreakpoint | undefined {
  if (value === 'lg' || value === 'md' || value === 'sm') return value;
  return fallback;
}

function normalizeGridSpec(raw: UISchema['grid'] | undefined, layoutColumns?: number): UIGridSpec {
  const columns = normalizeColumns(raw?.columns, normalizeColumns(layoutColumns, DEFAULT_COLUMNS));
  const rowHeight = normalizePositiveInt(raw?.rowHeight, DEFAULT_ROW_HEIGHT);
  const gap = normalizePositiveInt(raw?.gap, DEFAULT_GAP);

  const md = raw?.breakpoints?.md;
  const sm = raw?.breakpoints?.sm;

  return {
    columns,
    rowHeight,
    gap,
    collisionStrategy: raw?.collisionStrategy === 'swap' ? 'swap' : 'push',
    breakpoints: {
      md: {
        columns: normalizeColumns(md?.columns, Math.max(1, Math.min(columns, 8))),
        rowHeight: normalizePositiveInt(md?.rowHeight, Math.max(1, rowHeight - 4)),
        gap: normalizePositiveInt(md?.gap, Math.max(1, gap - 2)),
      },
      sm: {
        columns: normalizeColumns(sm?.columns, Math.max(1, Math.min(columns, 4))),
        rowHeight: normalizePositiveInt(sm?.rowHeight, Math.max(1, rowHeight - 8)),
        gap: normalizePositiveInt(sm?.gap, Math.max(1, gap - 4)),
      },
    },
  };
}

function defaultItemForComponent(
  componentId: string,
  index: number,
  columns: number,
  breakpoint?: LayoutBreakpoint,
): UIGridItem {
  const safeColumns = normalizeColumns(columns);
  const defaultWidth = Math.min(safeColumns, Math.max(2, Math.ceil(safeColumns / 3)));
  return {
    id: breakpoint ? `${componentId}:${breakpoint}` : componentId,
    componentId,
    x: 0,
    y: index * 2,
    w: defaultWidth,
    h: 2,
    breakpoint,
  };
}

function sanitizeItem(
  item: UIGridItem,
  index: number,
  columns: number,
  componentIdFallback: string,
  breakpointFallback?: LayoutBreakpoint,
): UIGridItem {
  const componentId = item.componentId || componentIdFallback;
  const breakpoint = normalizeBreakpoint(item.breakpoint, breakpointFallback);
  const safeColumns = normalizeColumns(columns);
  const w = Math.max(1, Math.min(safeColumns, Math.trunc(Number(item.w) || 1)));
  const h = Math.max(1, Math.trunc(Number(item.h) || 1));
  const maxX = Math.max(0, safeColumns - w);
  const x = Math.max(0, Math.min(maxX, Math.trunc(Number(item.x) || 0)));
  const y = Math.max(0, Math.trunc(Number(item.y) || index * 2));

  return {
    ...cloneItem(item),
    id: item.id || (breakpoint ? `${componentId}:${breakpoint}` : componentId),
    componentId,
    breakpoint,
    x,
    y,
    w,
    h,
  };
}

function sortItems(items: UIGridItem[]): UIGridItem[] {
  return [...items].sort((a, b) => {
    const ay = Number(a.y) || 0;
    const by = Number(b.y) || 0;
    if (ay !== by) return ay - by;
    const ax = Number(a.x) || 0;
    const bx = Number(b.x) || 0;
    if (ax !== bx) return ax - bx;
    return a.componentId.localeCompare(b.componentId);
  });
}

function buildLegacyItems(schema: UISchema, components: UIComponent[], columns: number): UIGridItem[] {
  const componentIdsFromLayout =
    schema.layout?.type === 'grid' && Array.isArray(schema.layout.componentIds)
      ? schema.layout.componentIds
      : components.map((component) => component.id);

  const byId = new Map(components.map((component) => [component.id, component]));
  const orderedIds: string[] = [];
  for (const id of componentIdsFromLayout) {
    if (!byId.has(id)) continue;
    if (orderedIds.includes(id)) continue;
    orderedIds.push(id);
  }
  for (const component of components) {
    if (orderedIds.includes(component.id)) continue;
    orderedIds.push(component.id);
  }

  return orderedIds.map((componentId, index) => defaultItemForComponent(componentId, index, columns));
}

function resolveColumnsForBreakpoint(spec: UIGridSpec, breakpoint: LayoutBreakpoint): number {
  if (breakpoint === 'lg') return spec.columns;
  return normalizeColumns(spec.breakpoints?.[breakpoint]?.columns, spec.columns);
}

function collectBaseItems(
  schema: UISchema,
  components: UIComponent[],
  spec: UIGridSpec,
): UIGridItem[] {
  const rawItems = Array.isArray(schema.items) ? schema.items : [];
  if (rawItems.length === 0) {
    return buildLegacyItems(schema, components, spec.columns);
  }

  const componentIds = new Set(components.map((component) => component.id));
  const sanitized = rawItems
    .filter((item) => componentIds.has(item.componentId))
    .map((item, index) => {
      const breakpoint = normalizeBreakpoint(item.breakpoint, undefined);
      const columns = resolveColumnsForBreakpoint(spec, breakpoint ?? 'lg');
      return sanitizeItem(item, index, columns, item.componentId, breakpoint);
    });

  const byKey = new Map<string, UIGridItem>();
  for (const item of sanitized) {
    const key = `${item.breakpoint ?? 'lg'}:${item.componentId}`;
    byKey.set(key, item);
  }

  for (const [index, component] of components.entries()) {
    const key = `lg:${component.id}`;
    if (!byKey.has(key)) {
      byKey.set(key, defaultItemForComponent(component.id, index, spec.columns));
    }
  }

  return sortItems(Array.from(byKey.values()));
}

function toLayoutComponentOrder(components: UIComponent[], items: UIGridItem[]): string[] {
  const componentIds = new Set(components.map((component) => component.id));
  const lgItems = items.filter((item) => !item.breakpoint || item.breakpoint === 'lg');
  const ordered = sortItems(lgItems)
    .map((item) => item.componentId)
    .filter((id, index, arr) => componentIds.has(id) && arr.indexOf(id) === index);

  for (const component of components) {
    if (ordered.includes(component.id)) continue;
    ordered.push(component.id);
  }
  return ordered;
}

function buildGridLayout(
  layout: UISchema['layout'] | undefined,
  components: UIComponent[],
  items: UIGridItem[],
  columns: number,
): GridLayout {
  return {
    ...(layout?.type === 'grid' ? layout : {}),
    id: layout?.id || 'root',
    type: 'grid',
    columns: normalizeColumns(columns),
    componentIds: toLayoutComponentOrder(components, items),
  };
}

export function normalizeFocusOrder(components: UIComponent[]): UIComponent[] {
  return components.map((component, index) => ({
    ...cloneComponent(component),
    accessibility: {
      ...(component.accessibility ?? {}),
      keyboardNav: true,
      focusOrder: index + 1,
      ariaLabelKey: component.accessibility?.ariaLabelKey ?? `runtime.builder.${component.id}.aria`,
    },
  }));
}

export function getSchemaComponents(schema: UISchema): UIComponent[] {
  return normalizeFocusOrder(schema.components as UIComponent[]);
}

export function getSchemaColumns(schema: UISchema): number {
  const normalized = normalizeSchema(schema);
  return normalized.grid?.columns ?? DEFAULT_COLUMNS;
}

export function getSchemaGridSpec(schema: UISchema): UIGridSpec {
  const normalized = normalizeSchema(schema);
  return normalized.grid ?? normalizeGridSpec(undefined, normalized.layout?.type === 'grid' ? normalized.layout.columns : undefined);
}

export function getSchemaItemsForBreakpoint(schema: UISchema, breakpoint: LayoutBreakpoint): UIGridItem[] {
  const normalized = normalizeSchema(schema);
  const items = normalized.items ?? [];

  if (breakpoint === 'lg') {
    return sortItems(
      items
        .filter((item) => !item.breakpoint || item.breakpoint === 'lg')
        .map((item) => sanitizeItem(item, 0, normalized.grid?.columns ?? DEFAULT_COLUMNS, item.componentId, 'lg')),
    );
  }

  const lgItems = getSchemaItemsForBreakpoint(normalized, 'lg');
  const overrides = new Map(
    items
      .filter((item) => item.breakpoint === breakpoint)
      .map((item) => [item.componentId, sanitizeItem(item, 0, resolveColumnsForBreakpoint(getSchemaGridSpec(normalized), breakpoint), item.componentId, breakpoint)]),
  );

  const columns = resolveColumnsForBreakpoint(getSchemaGridSpec(normalized), breakpoint);
  return sortItems(
    lgItems.map((base, index) => {
      const override = overrides.get(base.componentId);
      if (override) return sanitizeItem(override, index, columns, base.componentId, breakpoint);
      return sanitizeItem({ ...base, id: `${base.componentId}:${breakpoint}`, breakpoint }, index, columns, base.componentId, breakpoint);
    }),
  );
}

export function upsertSchemaItemsForBreakpoint(
  schema: UISchema,
  breakpoint: LayoutBreakpoint,
  nextItems: UIGridItem[],
): UISchema {
  const normalized = normalizeSchema(schema);
  const spec = getSchemaGridSpec(normalized);
  const columns = resolveColumnsForBreakpoint(spec, breakpoint);
  const sanitized = sortItems(
    nextItems.map((item, index) =>
      sanitizeItem(item, index, columns, item.componentId, breakpoint === 'lg' ? undefined : breakpoint),
    ),
  );

  const untouched = (normalized.items ?? []).filter((item) => {
    const itemBreakpoint = item.breakpoint ?? 'lg';
    return itemBreakpoint !== breakpoint;
  });

  const merged =
    breakpoint === 'lg'
      ? [...untouched, ...sanitized.map((item) => ({ ...item, breakpoint: undefined }))]
      : [...untouched, ...sanitized.map((item) => ({ ...item, breakpoint }))];

  return normalizeSchema({
    ...normalized,
    items: merged,
  });
}

export function setSchemaGridSpec(schema: UISchema, grid: Partial<UIGridSpec>): UISchema {
  const normalized = normalizeSchema(schema);
  const currentGrid = getSchemaGridSpec(normalized);
  const mergedGrid: UIGridSpec = {
    ...currentGrid,
    ...grid,
    breakpoints: {
      ...currentGrid.breakpoints,
      ...grid.breakpoints,
    },
  };
  const nextGrid = normalizeGridSpec(
    mergedGrid,
    normalized.layout?.type === 'grid' ? normalized.layout.columns : undefined,
  );

  return normalizeSchema({
    ...normalized,
    grid: nextGrid,
    layout: {
      ...(normalized.layout?.type === 'grid' ? normalized.layout : { id: 'root', type: 'grid' as const }),
      type: 'grid',
      columns: nextGrid.columns,
      componentIds: normalized.layout?.componentIds ?? normalized.components.map((component) => component.id),
    },
  });
}

export function normalizeSchema(schema: UISchema): UISchema {
  const components = normalizeFocusOrder(schema.components as UIComponent[]);
  const baseColumns = schema.layout?.type === 'grid' ? schema.layout.columns : undefined;
  const grid = normalizeGridSpec(schema.grid, baseColumns);
  const items = collectBaseItems(schema, components, grid);
  const layout = buildGridLayout(schema.layout, components, items, grid.columns);

  return {
    ...schema,
    version: schema.version || DEFAULT_VERSION,
    pageId: schema.pageId || DEFAULT_PAGE_ID,
    layoutType: 'grid',
    grid,
    items,
    layout,
    components,
  };
}

export function createSchemaFromComponents(
  components: UIComponent[],
  options?: {
    version?: string;
    pageId?: string;
    columns?: number;
  },
): UISchema {
  const normalized = normalizeFocusOrder(components);
  const columns = normalizeColumns(options?.columns, DEFAULT_COLUMNS);
  const grid = normalizeGridSpec(
    {
      columns,
      rowHeight: DEFAULT_ROW_HEIGHT,
      gap: DEFAULT_GAP,
      collisionStrategy: 'push',
    },
    columns,
  );
  const items = normalized.map((component, index) => defaultItemForComponent(component.id, index, columns));
  return normalizeSchema({
    version: options?.version || DEFAULT_VERSION,
    pageId: options?.pageId || DEFAULT_PAGE_ID,
    layoutType: 'grid',
    grid,
    items,
    layout: {
      id: 'root',
      type: 'grid',
      columns,
      componentIds: normalized.map((component) => component.id),
    },
    components: normalized,
  });
}

export function withUpdatedComponents(
  schema: UISchema,
  updater: (components: UIComponent[]) => UIComponent[],
): UISchema {
  const normalized = normalizeSchema(schema);
  const nextComponents = normalizeFocusOrder(updater(normalized.components as UIComponent[]));
  const componentIds = new Set(nextComponents.map((component) => component.id));
  const existing = (normalized.items ?? []).filter((item) => componentIds.has(item.componentId));
  const used = new Set(existing.map((item) => `${item.breakpoint ?? 'lg'}:${item.componentId}`));

  const lgColumns = normalized.grid?.columns ?? DEFAULT_COLUMNS;
  for (const [index, component] of nextComponents.entries()) {
    const key = `lg:${component.id}`;
    if (used.has(key)) continue;
    existing.push(defaultItemForComponent(component.id, index, lgColumns));
  }

  return normalizeSchema({
    ...normalized,
    components: nextComponents,
    items: existing,
  });
}

export function removeComponentFromSchema(schema: UISchema, componentId: string): UISchema {
  return withUpdatedComponents(schema, (components) => components.filter((component) => component.id !== componentId));
}

export function moveComponentInSchema(schema: UISchema, componentId: string, nextIndex: number): UISchema {
  const normalized = normalizeSchema(schema);
  const lgItems = getSchemaItemsForBreakpoint(normalized, 'lg');
  const currentIndex = lgItems.findIndex((item) => item.componentId === componentId);
  if (currentIndex < 0) return normalized;
  if (!Number.isFinite(nextIndex)) return normalized;
  const clampedIndex = Math.max(0, Math.min(lgItems.length - 1, Math.trunc(nextIndex)));
  if (clampedIndex === currentIndex) return normalized;

  const reordered = [...lgItems];
  const [moved] = reordered.splice(currentIndex, 1);
  if (!moved) return normalized;
  reordered.splice(clampedIndex, 0, moved);

  const columns = normalized.grid?.columns ?? DEFAULT_COLUMNS;
  const compacted = reordered.map((item, index) =>
    sanitizeItem(
      { ...item, x: 0, y: index * Math.max(1, item.h) },
      index,
      columns,
      item.componentId,
      undefined,
    ),
  );

  return upsertSchemaItemsForBreakpoint(normalized, 'lg', compacted);
}

export function isSchemaLike(value: unknown): value is UISchema {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<UISchema>;
  return typeof record.version === 'string' && typeof record.pageId === 'string' && Array.isArray(record.components);
}

export function migrateSchemaToGridLayout(schema: UISchema): UISchema {
  return normalizeSchema(schema);
}

export function listSupportedBreakpoints(): LayoutBreakpoint[] {
  return [...BREAKPOINTS];
}
