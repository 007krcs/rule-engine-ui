import type { FlowSchema, UISchema } from '@platform/schema';
import type { ConfigBundle } from '@/lib/demo/types';

const FALLBACK_PAGE_ID = 'builder-preview';

export type UiPagesShape = {
  uiSchema?: UISchema | null;
  uiSchemasById?: Record<string, UISchema> | null;
  activeUiPageId?: string | null;
  flowSchema?: FlowSchema | null;
};

export type UiPageUpdate = {
  uiSchema?: UISchema | null;
  uiSchemasById?: Record<string, UISchema> | null;
  activeUiPageId?: string | null;
  flowSchema?: FlowSchema | null;
};

export type NormalizedUiPages = {
  uiSchemasById: Record<string, UISchema>;
  activeUiPageId: string;
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUiSchema(value: unknown): value is UISchema {
  if (!isRecord(value)) return false;
  return typeof value.pageId === 'string' && Array.isArray(value.components) && isRecord(value.layout);
}

function sanitizePageId(raw: string | undefined | null, fallback: string): string {
  const cleaned = (raw ?? '').trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

function normalizeSchemaPageId(schema: UISchema, pageId: string): UISchema {
  const cloned = deepClone(schema);
  cloned.pageId = pageId;
  return cloned;
}

function firstFlowPageId(flowSchema?: FlowSchema | null): string | null {
  if (!flowSchema || !isRecord(flowSchema.states)) return null;
  const stateEntries = Object.entries(flowSchema.states);
  if (stateEntries.length === 0) return null;
  const initialState = flowSchema.initialState;
  if (initialState) {
    const preferred = flowSchema.states[initialState];
    const preferredPageId = sanitizePageId(preferred?.uiPageId, '');
    if (preferredPageId) return preferredPageId;
  }
  for (const [, state] of stateEntries) {
    const candidate = sanitizePageId(state?.uiPageId, '');
    if (candidate) return candidate;
  }
  return null;
}

export function normalizeUiPages(input: UiPagesShape): NormalizedUiPages {
  const map: Record<string, UISchema> = {};

  if (input.uiSchemasById && isRecord(input.uiSchemasById)) {
    for (const [rawKey, rawSchema] of Object.entries(input.uiSchemasById)) {
      if (!isUiSchema(rawSchema)) continue;
      const pageId = sanitizePageId(rawKey, sanitizePageId(rawSchema.pageId, FALLBACK_PAGE_ID));
      map[pageId] = normalizeSchemaPageId(rawSchema, pageId);
    }
  }

  if (Object.keys(map).length === 0 && input.uiSchema && isUiSchema(input.uiSchema)) {
    const pageId = sanitizePageId(input.uiSchema.pageId, FALLBACK_PAGE_ID);
    map[pageId] = normalizeSchemaPageId(input.uiSchema, pageId);
  }

  let activeUiPageId = sanitizePageId(input.activeUiPageId, '');
  if (!activeUiPageId || !map[activeUiPageId]) {
    const flowPageId = firstFlowPageId(input.flowSchema);
    if (flowPageId && map[flowPageId]) {
      activeUiPageId = flowPageId;
    }
  }

  if (!activeUiPageId || !map[activeUiPageId]) {
    activeUiPageId = Object.keys(map)[0] ?? FALLBACK_PAGE_ID;
  }

  return {
    uiSchemasById: map,
    activeUiPageId,
  };
}

export function rebindFlowSchemaToAvailablePages(
  flowSchema: FlowSchema | null | undefined,
  uiSchemasById: Record<string, UISchema>,
  fallbackPageId: string,
): FlowSchema | null {
  if (!flowSchema) return null;
  const availablePages = new Set(Object.keys(uiSchemasById));
  if (availablePages.size === 0) return deepClone(flowSchema);

  const effectiveFallback = availablePages.has(fallbackPageId)
    ? fallbackPageId
    : (Array.from(availablePages)[0] ?? FALLBACK_PAGE_ID);

  const nextStates = Object.fromEntries(
    Object.entries(flowSchema.states).map(([stateId, state]) => {
      const nextPageId = availablePages.has(state.uiPageId) ? state.uiPageId : effectiveFallback;
      return [stateId, { ...state, uiPageId: nextPageId }];
    }),
  );

  return {
    ...deepClone(flowSchema),
    states: nextStates,
  };
}

export function applyUiPageUpdateToBundle(bundle: ConfigBundle, update: UiPageUpdate): ConfigBundle {
  const baseFlow = update.flowSchema ?? bundle.flowSchema ?? null;
  const existing = normalizeUiPages({
    uiSchema: bundle.uiSchema,
    uiSchemasById: bundle.uiSchemasById,
    activeUiPageId: bundle.activeUiPageId,
    flowSchema: baseFlow,
  });

  let nextPages = { ...existing.uiSchemasById };
  let nextActive = existing.activeUiPageId;

  if (update.uiSchemasById && Object.keys(update.uiSchemasById).length > 0) {
    const incoming = normalizeUiPages({
      uiSchemasById: update.uiSchemasById,
      uiSchema: update.uiSchema,
      activeUiPageId: update.activeUiPageId ?? nextActive,
      flowSchema: baseFlow,
    });
    nextPages = incoming.uiSchemasById;
    nextActive = incoming.activeUiPageId;
  } else if (update.uiSchema && isUiSchema(update.uiSchema)) {
    const pageId = sanitizePageId(
      update.activeUiPageId,
      sanitizePageId(update.uiSchema.pageId, sanitizePageId(nextActive, FALLBACK_PAGE_ID)),
    );
    nextPages[pageId] = normalizeSchemaPageId(update.uiSchema, pageId);
    nextActive = pageId;
  }

  const desiredActive = sanitizePageId(update.activeUiPageId, nextActive);
  if (desiredActive && nextPages[desiredActive]) {
    nextActive = desiredActive;
  }

  if (!nextPages[nextActive]) {
    nextActive = Object.keys(nextPages)[0] ?? FALLBACK_PAGE_ID;
  }

  const reboundFlow = rebindFlowSchemaToAvailablePages(baseFlow, nextPages, nextActive);
  const activeSchema = nextPages[nextActive] ?? bundle.uiSchema;

  return {
    ...bundle,
    ...(reboundFlow ? { flowSchema: reboundFlow } : {}),
    uiSchemasById: nextPages,
    activeUiPageId: nextActive,
    uiSchema: activeSchema,
  };
}

export function createSinglePageBundle(input: {
  uiSchema: UISchema;
  flowSchema: FlowSchema;
  rules: ConfigBundle['rules'];
  apiMappingsById: ConfigBundle['apiMappingsById'];
}): ConfigBundle {
  const pageId = sanitizePageId(input.uiSchema.pageId, FALLBACK_PAGE_ID);
  const normalizedUi = normalizeSchemaPageId(input.uiSchema, pageId);
  const uiSchemasById = {
    [pageId]: normalizedUi,
  };
  const reboundFlow = rebindFlowSchemaToAvailablePages(input.flowSchema, uiSchemasById, pageId);

  return {
    uiSchema: normalizedUi,
    uiSchemasById,
    activeUiPageId: pageId,
    flowSchema: reboundFlow ?? input.flowSchema,
    rules: input.rules,
    apiMappingsById: input.apiMappingsById,
  };
}
