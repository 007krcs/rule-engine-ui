import type { ApiMapping, FlowSchema, JSONValue } from '@platform/schema';
import { validateApiMapping, validateFlowSchema, type ValidationIssue } from '@platform/validator';

export type BuilderValidationIssue = ValidationIssue & {
  code?: string;
};

export function createDefaultFlowSchema(pageId: string): FlowSchema {
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

export function normalizeFlowSchema(flow: FlowSchema | null | undefined, fallbackPageId: string): FlowSchema {
  if (!flow || !flow.states || Object.keys(flow.states).length === 0) {
    return createDefaultFlowSchema(fallbackPageId);
  }

  const cloned = deepClone(flow);
  const stateIds = Object.keys(cloned.states);
  if (stateIds.length === 0) return createDefaultFlowSchema(fallbackPageId);

  const preferredInitial = cloned.initialState?.trim() || '';
  const initialState =
    preferredInitial && cloned.states[preferredInitial]
      ? preferredInitial
      : (stateIds[0] ?? 'start');

  cloned.initialState = initialState;
  for (const stateId of stateIds) {
    const state = cloned.states[stateId];
    if (!state) continue;
    const uiPageId = state.uiPageId?.trim() || fallbackPageId;
    cloned.states[stateId] = {
      ...state,
      uiPageId,
      on: state.on ?? {},
    };
  }

  return cloned;
}

export function validateFlowBuilderSchema(
  flow: FlowSchema,
  availablePageIds: string[] = [],
): BuilderValidationIssue[] {
  const issues: BuilderValidationIssue[] = validateFlowSchema(flow).issues.map((issue) => ({
    ...issue,
  }));

  const stateIds = Object.keys(flow.states ?? {});
  if (stateIds.length === 0) {
    issues.push({
      code: 'flow.no_states',
      path: 'flowSchema.states',
      message: 'Add at least one state to continue.',
      severity: 'error',
    });
  }

  const stateIdSet = new Set(stateIds);
  if (!flow.initialState || !stateIdSet.has(flow.initialState)) {
    issues.push({
      code: 'flow.initial_missing',
      path: 'flowSchema.initialState',
      message: `Initial state "${flow.initialState || '(empty)'}" does not exist.`,
      severity: 'error',
    });
  }

  const inboundCount = new Map<string, number>();
  for (const stateId of stateIds) inboundCount.set(stateId, 0);

  const pageSet = new Set(availablePageIds.filter((value) => value.trim().length > 0));

  for (const stateId of stateIds) {
    const state = flow.states[stateId];
    if (!state) continue;

    if (pageSet.size > 0 && !pageSet.has(state.uiPageId)) {
      issues.push({
        code: 'flow.page_missing',
        path: `flowSchema.states.${stateId}.uiPageId`,
        message: `State "${stateId}" references unknown page "${state.uiPageId}".`,
        severity: 'error',
      });
    }

    for (const [event, transition] of Object.entries(state.on ?? {})) {
      if (!transition.target || !stateIdSet.has(transition.target)) {
        issues.push({
          code: 'flow.target_missing',
          path: `flowSchema.states.${stateId}.on.${event}.target`,
          message: `Transition target "${transition.target || '(empty)'}" does not exist.`,
          severity: 'error',
        });
        continue;
      }
      inboundCount.set(transition.target, (inboundCount.get(transition.target) ?? 0) + 1);
    }
  }

  for (const stateId of stateIds) {
    if (stateId === flow.initialState) continue;
    const inbound = inboundCount.get(stateId) ?? 0;
    if (inbound === 0) {
      issues.push({
        code: 'flow.orphan_state',
        path: `flowSchema.states.${stateId}`,
        message: `State "${stateId}" is orphaned (no incoming transitions).`,
        severity: 'warning',
      });
    }
  }

  return dedupeIssues(issues);
}

export function createDefaultApiMapping(apiId: string): ApiMapping {
  const safeId = apiId.trim() || 'newMapping';
  return {
    version: '1.0.0',
    apiId: safeId,
    type: 'rest',
    method: 'GET',
    endpoint: 'https://api.example.com/resource',
    requestMap: {
      query: {},
      body: {},
      headers: {},
    },
    responseMap: {
      data: {},
      context: {},
    },
  };
}

export function normalizeApiMappingsById(
  mappingsById: Record<string, ApiMapping> | null | undefined,
): Record<string, ApiMapping> {
  if (!mappingsById) return {};
  const next: Record<string, ApiMapping> = {};
  for (const [id, mapping] of Object.entries(mappingsById)) {
    if (!mapping || typeof mapping !== 'object') continue;
    const normalizedId = (mapping.apiId?.trim() || id.trim() || 'mapping');
    next[id] = {
      ...deepClone(mapping),
      apiId: normalizedId,
      requestMap: mapping.requestMap ?? {},
      responseMap: mapping.responseMap ?? {},
    };
  }
  return next;
}

export function validateApiMappingsById(
  mappingsById: Record<string, ApiMapping>,
): BuilderValidationIssue[] {
  const issues: BuilderValidationIssue[] = [];
  const usedApiIds = new Map<string, string>();

  for (const [mappingId, mapping] of Object.entries(mappingsById)) {
    const pathPrefix = `apiMappingsById.${mappingId}`;
    const normalizedApiId = mapping.apiId?.trim() || '';

    if (!normalizedApiId) {
      issues.push({
        code: 'api.api_id_missing',
        path: `${pathPrefix}.apiId`,
        message: 'API Id is required.',
        severity: 'error',
      });
    } else {
      const duplicate = usedApiIds.get(normalizedApiId);
      if (duplicate && duplicate !== mappingId) {
        issues.push({
          code: 'api.api_id_duplicate',
          path: `${pathPrefix}.apiId`,
          message: `API Id "${normalizedApiId}" is already used by "${duplicate}".`,
          severity: 'error',
        });
      } else {
        usedApiIds.set(normalizedApiId, mappingId);
      }
    }

    if (normalizedApiId && normalizedApiId !== mappingId) {
      issues.push({
        code: 'api.id_mismatch',
        path: pathPrefix,
        message: `Mapping key "${mappingId}" and apiId "${normalizedApiId}" should match.`,
        severity: 'warning',
      });
    }

    const validation = validateApiMapping(mapping);
    for (const issue of validation.issues) {
      issues.push({
        ...issue,
        code: 'api.schema_invalid',
        path: issue.path ? `${pathPrefix}.${issue.path}` : pathPrefix,
      });
    }
  }

  return dedupeIssues(issues);
}

export function hasBlockingIssues(issues: BuilderValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

export function parseJsonText(value: string): JSONValue {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return JSON.parse(trimmed) as JSONValue;
  } catch {
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;
    return trimmed;
  }
}

export function stringifyJsonValue(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function dedupeIssues(issues: BuilderValidationIssue[]): BuilderValidationIssue[] {
  const deduped = new Map<string, BuilderValidationIssue>();
  for (const issue of issues) {
    deduped.set(`${issue.severity}:${issue.path}:${issue.message}`, issue);
  }
  return Array.from(deduped.values());
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
