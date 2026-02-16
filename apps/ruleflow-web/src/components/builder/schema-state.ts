import type { UIComponent, UISchema } from '@platform/schema';

type GridLayout = Extract<UISchema['layout'], { type: 'grid' }>;

const DEFAULT_VERSION = '1.0.0';
const DEFAULT_PAGE_ID = 'builder-preview';
const DEFAULT_COLUMNS = 1;

function cloneComponent(component: UIComponent): UIComponent {
  return JSON.parse(JSON.stringify(component)) as UIComponent;
}

function normalizeColumns(columns: number | undefined): number {
  if (!Number.isFinite(columns) || !columns) return DEFAULT_COLUMNS;
  return Math.max(DEFAULT_COLUMNS, Math.trunc(columns));
}

function buildGridLayout(layout: UISchema['layout'] | undefined, components: UIComponent[]): GridLayout {
  const componentIds = components.map((component) => component.id);
  if (layout?.type === 'grid') {
    return {
      ...layout,
      id: layout.id || 'root',
      type: 'grid',
      columns: normalizeColumns(layout.columns),
      componentIds,
    };
  }

  return {
    id: 'root',
    type: 'grid',
    columns: DEFAULT_COLUMNS,
    componentIds,
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
  if (schema.layout?.type !== 'grid') return DEFAULT_COLUMNS;
  return normalizeColumns(schema.layout.columns);
}

export function normalizeSchema(schema: UISchema): UISchema {
  const components = normalizeFocusOrder(schema.components as UIComponent[]);
  return {
    ...schema,
    version: schema.version || DEFAULT_VERSION,
    pageId: schema.pageId || DEFAULT_PAGE_ID,
    layout: buildGridLayout(schema.layout, components),
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
  return {
    version: options?.version || DEFAULT_VERSION,
    pageId: options?.pageId || DEFAULT_PAGE_ID,
    layout: {
      id: 'root',
      type: 'grid',
      columns: normalizeColumns(options?.columns),
      componentIds: normalized.map((component) => component.id),
    },
    components: normalized,
  };
}

export function withUpdatedComponents(schema: UISchema, updater: (components: UIComponent[]) => UIComponent[]): UISchema {
  const normalized = normalizeSchema(schema);
  const next = normalizeFocusOrder(updater(normalized.components as UIComponent[]));
  return {
    ...normalized,
    layout: {
      ...normalized.layout,
      type: 'grid',
      columns: getSchemaColumns(normalized),
      componentIds: next.map((component) => component.id),
    },
    components: next,
  };
}

export function removeComponentFromSchema(schema: UISchema, componentId: string): UISchema {
  return withUpdatedComponents(schema, (components) => components.filter((component) => component.id !== componentId));
}

export function moveComponentInSchema(schema: UISchema, componentId: string, nextIndex: number): UISchema {
  return withUpdatedComponents(schema, (components) => {
    const currentIndex = components.findIndex((component) => component.id === componentId);
    if (currentIndex < 0) return components;
    if (!Number.isFinite(nextIndex)) return components;
    const clampedIndex = Math.max(0, Math.min(components.length - 1, Math.trunc(nextIndex)));
    if (clampedIndex === currentIndex) return components;

    const next = [...components];
    const [moved] = next.splice(currentIndex, 1);
    if (!moved) return components;
    next.splice(clampedIndex, 0, moved);
    return next;
  });
}

export function isSchemaLike(value: unknown): value is UISchema {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<UISchema>;
  return typeof record.version === 'string' && typeof record.pageId === 'string' && Array.isArray(record.components);
}
