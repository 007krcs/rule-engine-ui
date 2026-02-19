import {
  addFlowScreen,
  createFlowGraph,
  createFlowScreen,
  createFlowTransition,
  removeFlowScreen,
  removeFlowTransition,
  stateMachineToFlowGraph,
  upsertFlowTransition,
  updateFlowScreen,
  type FlowGraphSchema,
  type FlowTransitionEdge,
} from '@platform/schema';
import type { UISchema } from '@platform/schema';
import { createInitialBuilderSchema } from './layout-engine';

export interface BuilderFlowState {
  flow: FlowGraphSchema;
  schemasByScreenId: Record<string, UISchema>;
  activeScreenId: string;
}

export interface AddScreenResult {
  flow: FlowGraphSchema;
  schemasByScreenId: Record<string, UISchema>;
  newScreenId: string;
}

export function createInitialBuilderFlowState(): BuilderFlowState {
  const firstScreenId = 'screen-1';
  const firstScreen = createFlowScreen({
    id: firstScreenId,
    title: 'Screen 1',
    uiPageId: `${firstScreenId}-page`,
    position: nextScreenPosition(0),
  });

  return {
    flow: createFlowGraph({
      flowId: 'builder-flow',
      screens: [firstScreen],
      initialScreenId: firstScreenId,
      transitions: [],
    }),
    schemasByScreenId: {
      [firstScreenId]: createInitialBuilderSchema(firstScreen.uiPageId),
    },
    activeScreenId: firstScreenId,
  };
}

export function createBuilderFlowStateFromLegacy(
  flowStateMachine: Parameters<typeof stateMachineToFlowGraph>[0],
): BuilderFlowState {
  const graph = stateMachineToFlowGraph(flowStateMachine);
  const schemasByScreenId = Object.fromEntries(
    graph.screens.map((screen) => [screen.id, createInitialBuilderSchema(screen.uiPageId)]),
  );

  const fallbackScreenId = graph.screens[0]?.id ?? createInitialBuilderFlowState().activeScreenId;

  return {
    flow: graph,
    schemasByScreenId,
    activeScreenId: graph.initialScreenId || fallbackScreenId,
  };
}

export function addBuilderScreen(
  flow: FlowGraphSchema,
  schemasByScreenId: Record<string, UISchema>,
  title?: string,
): AddScreenResult {
  const screenId = createUniqueScreenId(flow, title ?? 'screen');
  const screenTitle = normalizeScreenTitle(title, flow.screens.length + 1);
  const uiPageId = `${screenId}-page`;

  const nextFlow = addFlowScreen(
    flow,
    createFlowScreen({
      id: screenId,
      title: screenTitle,
      uiPageId,
      position: nextScreenPosition(flow.screens.length),
    }),
  );

  return {
    flow: nextFlow,
    schemasByScreenId: {
      ...schemasByScreenId,
      [screenId]: createInitialBuilderSchema(uiPageId),
    },
    newScreenId: screenId,
  };
}

export function removeBuilderScreen(
  flow: FlowGraphSchema,
  schemasByScreenId: Record<string, UISchema>,
  screenId: string,
): AddScreenResult {
  if (flow.screens.length <= 1) {
    return {
      flow,
      schemasByScreenId,
      newScreenId: flow.initialScreenId,
    };
  }

  const nextFlow = removeFlowScreen(flow, screenId);
  const nextSchemas = { ...schemasByScreenId };
  delete nextSchemas[screenId];
  const fallbackScreenId = nextFlow.initialScreenId || nextFlow.screens[0]?.id || '';

  return {
    flow: nextFlow,
    schemasByScreenId: nextSchemas,
    newScreenId: fallbackScreenId,
  };
}

export function renameBuilderScreen(flow: FlowGraphSchema, screenId: string, title: string): FlowGraphSchema {
  return updateFlowScreen(flow, screenId, {
    title: title.trim() || 'Untitled Screen',
  });
}

export function rebindBuilderScreenPage(
  flow: FlowGraphSchema,
  schemasByScreenId: Record<string, UISchema>,
  screenId: string,
  uiPageId: string,
): { flow: FlowGraphSchema; schemasByScreenId: Record<string, UISchema> } {
  const normalizedPageId = uiPageId.trim() || `${screenId}-page`;
  const nextFlow = updateFlowScreen(flow, screenId, {
    uiPageId: normalizedPageId,
  });

  const existingSchema = schemasByScreenId[screenId] ?? createInitialBuilderSchema(normalizedPageId);
  const nextSchema: UISchema = {
    ...existingSchema,
    pageId: normalizedPageId,
  };

  return {
    flow: nextFlow,
    schemasByScreenId: {
      ...schemasByScreenId,
      [screenId]: nextSchema,
    },
  };
}

export function addBuilderTransition(
  flow: FlowGraphSchema,
  input: {
    from: string;
    to: string;
    onEvent?: string;
    condition?: string;
  },
): { flow: FlowGraphSchema; transitionId: string } {
  const transition = createFlowTransition({
    from: input.from,
    to: input.to,
    onEvent: input.onEvent ?? 'next',
    condition: normalizeOptionalText(input.condition),
  });

  return {
    flow: upsertFlowTransition(flow, transition),
    transitionId: transition.id,
  };
}

export function updateBuilderTransition(
  flow: FlowGraphSchema,
  transitionId: string,
  patch: Partial<Pick<FlowTransitionEdge, 'from' | 'to' | 'onEvent' | 'condition'>>,
): FlowGraphSchema {
  const existing = flow.transitions.find((transition) => transition.id === transitionId);
  if (!existing) {
    return flow;
  }

  return upsertFlowTransition(flow, {
    ...existing,
    ...patch,
    onEvent: patch.onEvent?.trim() || existing.onEvent,
    condition:
      typeof patch.condition === 'string'
        ? normalizeOptionalText(patch.condition)
        : patch.condition ?? existing.condition,
  });
}

export function deleteBuilderTransition(flow: FlowGraphSchema, transitionId: string): FlowGraphSchema {
  return removeFlowTransition(flow, transitionId);
}

export function updateBuilderScreenPosition(
  flow: FlowGraphSchema,
  screenId: string,
  position: { x: number; y: number },
): FlowGraphSchema {
  return updateFlowScreen(flow, screenId, {
    position: {
      x: Math.max(0, Math.round(position.x)),
      y: Math.max(0, Math.round(position.y)),
    },
  });
}

function createUniqueScreenId(flow: FlowGraphSchema, rawTitle: string): string {
  const normalized = rawTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = normalized.length > 0 ? normalized : 'screen';
  const existing = new Set(flow.screens.map((screen) => screen.id));

  if (!existing.has(base)) {
    return base;
  }

  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (existing.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

function normalizeScreenTitle(title: string | undefined, fallbackIndex: number): string {
  const normalized = title?.trim();
  if (!normalized) {
    return `Screen ${fallbackIndex}`;
  }
  return normalized;
}

function nextScreenPosition(index: number): { x: number; y: number } {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: 80 + column * 280,
    y: 100 + row * 200,
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
