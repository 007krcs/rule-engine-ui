import type { FlowSchema, UISchema } from './types';

type BundleLike = {
  uiSchema?: UISchema;
  uiSchemasById?: Record<string, UISchema>;
  activeUiPageId?: string;
  flowSchema?: FlowSchema;
  [key: string]: unknown;
};

export type UiSchemaMigrationResult<T extends BundleLike> = {
  migrated: T;
  changed: boolean;
  pageCount: number;
};

export function migrateBundleToMultiPage<T extends BundleLike>(bundle: T): UiSchemaMigrationResult<T> {
  const next = deepClone(bundle) as BundleLike;
  const byId = normalizeUiSchemasById(next.uiSchemasById);
  let changed = false;

  if (Object.keys(byId).length === 0 && next.uiSchema) {
    const pageId = sanitizePageId(next.uiSchema.pageId, 'builder-preview');
    byId[pageId] = { ...deepClone(next.uiSchema), pageId };
    changed = true;
  }

  if (Object.keys(byId).length === 0) {
    return { migrated: bundle, changed: false, pageCount: 0 };
  }

  const activeRaw = sanitizePageId(next.activeUiPageId, '');
  const active = byId[activeRaw] ? activeRaw : Object.keys(byId)[0]!;
  const activeUi = byId[active];
  if (!activeUi) {
    return { migrated: bundle, changed: false, pageCount: 0 };
  }
  if (next.activeUiPageId !== active) {
    changed = true;
  }

  const existingUi = next.uiSchema;
  if (!existingUi || existingUi.pageId !== activeUi.pageId) {
    changed = true;
  }

  next.uiSchemasById = byId;
  next.activeUiPageId = active;
  next.uiSchema = activeUi;

  if (next.flowSchema) {
    const rebound = rebindFlowSchema(next.flowSchema, byId, active);
    if (JSON.stringify(rebound) !== JSON.stringify(next.flowSchema)) {
      changed = true;
      next.flowSchema = rebound;
    }
  }

  return {
    migrated: next as T,
    changed,
    pageCount: Object.keys(byId).length,
  };
}

function rebindFlowSchema(
  flowSchema: FlowSchema,
  uiSchemasById: Record<string, UISchema>,
  fallbackPageId: string,
): FlowSchema {
  const pageIds = new Set(Object.keys(uiSchemasById));
  return {
    ...flowSchema,
    states: Object.fromEntries(
      Object.entries(flowSchema.states).map(([stateId, state]) => [
        stateId,
        {
          ...state,
          uiPageId: pageIds.has(state.uiPageId) ? state.uiPageId : fallbackPageId,
        },
      ]),
    ),
  };
}

function normalizeUiSchemasById(input: Record<string, UISchema> | undefined): Record<string, UISchema> {
  const out: Record<string, UISchema> = {};
  for (const [key, schema] of Object.entries(input ?? {})) {
    const pageId = sanitizePageId(schema.pageId, sanitizePageId(key, 'builder-preview'));
    out[pageId] = { ...deepClone(schema), pageId };
  }
  return out;
}

function sanitizePageId(value: string | undefined, fallback: string): string {
  const next = (value ?? '').trim();
  return next.length > 0 ? next : fallback;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
