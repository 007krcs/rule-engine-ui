import type { FlowAction, FlowSchema, FlowTransition, JSONValue, RuleCondition } from './types';

export interface FlowScreenPosition {
  x: number;
  y: number;
}

export interface FlowScreenNode {
  id: string;
  title: string;
  uiPageId: string;
  description?: string;
  position?: FlowScreenPosition;
  metadata?: Record<string, JSONValue>;
}

export type FlowConditionExpression = string | RuleCondition;

export interface FlowTransitionEdge {
  id: string;
  from: string;
  to: string;
  onEvent: string;
  condition?: FlowConditionExpression;
  actions?: FlowAction[];
  apiId?: string;
  priority?: number;
  weight?: number;
  delayMs?: number;
  label?: string;
  metadata?: Record<string, JSONValue>;
}

export interface FlowGraphSchema {
  version: string;
  flowId: string;
  initialScreenId: string;
  screens: FlowScreenNode[];
  transitions: FlowTransitionEdge[];
}

let flowIdCounter = 0;

export function createFlowGraphId(prefix: string): string {
  flowIdCounter += 1;
  return `${prefix}-${flowIdCounter}`;
}

export interface CreateFlowScreenOptions {
  id?: string;
  title?: string;
  uiPageId?: string;
  description?: string;
  position?: FlowScreenPosition;
}

export function createFlowScreen(options: CreateFlowScreenOptions = {}): FlowScreenNode {
  const id = options.id ?? createFlowGraphId('screen');
  return {
    id,
    title: options.title ?? normalizeScreenTitle(id),
    uiPageId: options.uiPageId ?? id,
    description: options.description,
    position: options.position,
  };
}

export interface CreateFlowTransitionOptions {
  id?: string;
  from: string;
  to: string;
  onEvent?: string;
  condition?: FlowConditionExpression;
  actions?: FlowAction[];
  apiId?: string;
  priority?: number;
  weight?: number;
  delayMs?: number;
  label?: string;
}

export function createFlowTransition(options: CreateFlowTransitionOptions): FlowTransitionEdge {
  return {
    id: options.id ?? createFlowGraphId('transition'),
    from: options.from,
    to: options.to,
    onEvent: options.onEvent ?? 'next',
    condition: options.condition,
    actions: options.actions ?? [],
    apiId: options.apiId,
    priority: options.priority,
    weight: options.weight,
    delayMs: options.delayMs,
    label: options.label,
  };
}

export interface CreateFlowGraphOptions {
  flowId: string;
  version?: string;
  screens?: FlowScreenNode[];
  transitions?: FlowTransitionEdge[];
  initialScreenId?: string;
}

export function createFlowGraph(options: CreateFlowGraphOptions): FlowGraphSchema {
  const screens = options.screens ?? [createFlowScreen({ id: 'screen-1', title: 'Screen 1' })];
  const initialScreenId = options.initialScreenId ?? screens[0]?.id ?? 'screen-1';
  return {
    version: options.version ?? '1.0.0',
    flowId: options.flowId,
    initialScreenId,
    screens,
    transitions: options.transitions ?? [],
  };
}

export function addFlowScreen(flow: FlowGraphSchema, screen: FlowScreenNode): FlowGraphSchema {
  return {
    ...flow,
    screens: [...flow.screens, screen],
  };
}

export function updateFlowScreen(
  flow: FlowGraphSchema,
  screenId: string,
  patch: Partial<Omit<FlowScreenNode, 'id'>>,
): FlowGraphSchema {
  return {
    ...flow,
    screens: flow.screens.map((screen) =>
      screen.id === screenId
        ? {
            ...screen,
            ...patch,
          }
        : screen,
    ),
  };
}

export function removeFlowScreen(flow: FlowGraphSchema, screenId: string): FlowGraphSchema {
  const nextScreens = flow.screens.filter((screen) => screen.id !== screenId);
  const nextTransitions = flow.transitions.filter(
    (transition) => transition.from !== screenId && transition.to !== screenId,
  );
  const nextInitial = flow.initialScreenId === screenId ? nextScreens[0]?.id ?? '' : flow.initialScreenId;
  return {
    ...flow,
    screens: nextScreens,
    transitions: nextTransitions,
    initialScreenId: nextInitial,
  };
}

export function upsertFlowTransition(flow: FlowGraphSchema, transition: FlowTransitionEdge): FlowGraphSchema {
  const existingIndex = flow.transitions.findIndex((candidate) => candidate.id === transition.id);
  if (existingIndex < 0) {
    return {
      ...flow,
      transitions: [...flow.transitions, transition],
    };
  }

  return {
    ...flow,
    transitions: flow.transitions.map((candidate) =>
      candidate.id === transition.id
        ? {
            ...candidate,
            ...transition,
          }
        : candidate,
    ),
  };
}

export function removeFlowTransition(flow: FlowGraphSchema, transitionId: string): FlowGraphSchema {
  return {
    ...flow,
    transitions: flow.transitions.filter((transition) => transition.id !== transitionId),
  };
}

export function flowGraphToStateMachine(flow: FlowGraphSchema): FlowSchema {
  const states: FlowSchema['states'] = {};

  for (const screen of flow.screens) {
    states[screen.id] = {
      uiPageId: screen.uiPageId,
      on: {},
    };
  }

  for (const transition of flow.transitions) {
    const state = states[transition.from];
    if (!state) continue;

    const eventName = createUniqueEventName(state.on, transition.onEvent);
    const nextTransition: FlowTransition = {
      target: transition.to,
      actions: transition.actions,
      apiId: transition.apiId,
      priority: transition.priority,
      weight: transition.weight,
      delayMs: transition.delayMs,
    };

    if (transition.condition !== undefined) {
      nextTransition.condition = transition.condition;
      if (typeof transition.condition !== 'string') {
        nextTransition.guard = transition.condition;
      }
    }

    state.on[eventName] = nextTransition;
  }

  const initialState = states[flow.initialScreenId] ? flow.initialScreenId : flow.screens[0]?.id ?? 'start';

  return {
    version: flow.version,
    flowId: flow.flowId,
    initialState,
    states,
  };
}

export function stateMachineToFlowGraph(flow: FlowSchema): FlowGraphSchema {
  const stateEntries = Object.entries(flow.states ?? {});
  const screens = stateEntries.map(([stateId, state], index) =>
    createFlowScreen({
      id: stateId,
      title: normalizeScreenTitle(stateId),
      uiPageId: state.uiPageId,
      position: {
        x: 80 + (index % 3) * 260,
        y: 90 + Math.floor(index / 3) * 190,
      },
    }),
  );

  const transitions: FlowTransitionEdge[] = [];
  for (const [fromState, state] of stateEntries) {
    for (const [eventName, transition] of Object.entries(state.on ?? {})) {
      transitions.push(
        createFlowTransition({
          from: fromState,
          to: transition.target,
          onEvent: eventName,
          condition: transition.condition ?? transition.guard,
          actions: transition.actions,
          apiId: transition.apiId,
          priority: transition.priority,
          weight: transition.weight,
          delayMs: transition.delayMs,
        }),
      );
    }
  }

  return {
    version: flow.version,
    flowId: flow.flowId,
    initialScreenId: flow.initialState,
    screens,
    transitions,
  };
}

function createUniqueEventName(
  transitions: Record<string, FlowTransition>,
  requestedEventName: string,
): string {
  const baseName = requestedEventName.trim() || 'next';
  if (!transitions[baseName]) {
    return baseName;
  }

  let suffix = 2;
  let nextName = `${baseName}_${suffix}`;
  while (transitions[nextName]) {
    suffix += 1;
    nextName = `${baseName}_${suffix}`;
  }
  return nextName;
}

function normalizeScreenTitle(id: string): string {
  const compact = id
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  if (!compact) return 'Screen';
  return compact.replace(/\b\w/g, (char) => char.toUpperCase());
}
