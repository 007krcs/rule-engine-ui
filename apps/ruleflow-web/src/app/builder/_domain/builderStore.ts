"use client";

import { create } from 'zustand';
import { produce } from 'immer';
import type { FlowSchema, Rule, UISchema } from '@platform/schema';
import { createUISchema } from '@platform/schema';
import type { BuilderState, FlowEdge } from './types';

type BuilderActions = {
  addScreen: (id?: string, schema?: UISchema) => void;
  removeScreen: (id: string) => void;
  updateScreen: (id: string, schema: UISchema) => void;
  setActiveScreen: (id: string | null) => void;
  updateFlow: (updater: (flow: BuilderState['flow']) => BuilderState['flow']) => void;
  addRule: (rule: Rule) => void;
  updateRule: (ruleId: string, patch: Partial<Rule>) => void;
  setRules: (rules: Record<string, Rule>) => void;
  setFlowSchema: (schema: FlowSchema) => void;
};

const initialState: BuilderState = {
  screens: {},
  activeScreenId: null,
  flow: {
    startNodeId: null,
    nodes: [],
    edges: [],
    schema: { version: '1.0.0', flowId: 'flow', initialState: '', states: {} },
  },
  rules: {},
  metadata: {
    version: '1.0.0',
    status: 'draft',
    updatedAt: Date.now(),
  },
};

export const useBuilderStore = create<BuilderState & BuilderActions>((set) => ({
  ...initialState,
  ...createActions(set),
}));

function createActions(
  set: (fn: (state: BuilderState & BuilderActions) => BuilderState & BuilderActions) => void,
): BuilderActions {
  const applyDraft = (recipe: (draft: BuilderState) => void) => {
    set((state) => produce(state, (draft) => recipe(draft as unknown as BuilderState)));
  };

  return {
    addScreen: (id, schema) =>
      applyDraft((draft) => {
        const nextId = id?.trim() || `screen-${Object.keys(draft.screens).length + 1}`;
        if (draft.screens[nextId]) return;
        const uiSchema = schema ?? createUISchema({ pageId: nextId });
        draft.screens[nextId] = uiSchema;
        draft.activeScreenId = draft.activeScreenId ?? nextId;
        draft.flow.nodes.push({ id: nextId, position: { x: 100, y: 100 }, label: nextId });
        draft.flow.schema = upsertFlowState(draft.flow.schema, nextId);
        if (!draft.flow.startNodeId) draft.flow.startNodeId = nextId;
      }),

    removeScreen: (id) =>
      applyDraft((draft) => {
        delete draft.screens[id];
        draft.flow.nodes = draft.flow.nodes.filter((n) => n.id !== id);
        draft.flow.edges = draft.flow.edges.filter((e) => e.from !== id && e.to !== id);
        if (draft.flow.schema) {
          const rest = { ...draft.flow.schema.states };
          delete rest[id];
          draft.flow.schema.states = rest;
          if (draft.flow.schema.initialState === id) {
            draft.flow.schema.initialState = Object.keys(rest)[0] ?? '';
          }
        }
        if (draft.activeScreenId === id) {
          draft.activeScreenId = Object.keys(draft.screens)[0] ?? null;
        }
      }),

    updateScreen: (id, schema) =>
      applyDraft((draft) => {
        draft.screens[id] = schema;
      }),

    setActiveScreen: (id) =>
      applyDraft((draft) => {
        draft.activeScreenId = id;
      }),

    updateFlow: (updater) =>
      applyDraft((draft) => {
        draft.flow = updater(draft.flow);
      }),

    setFlowSchema: (schema: FlowSchema) =>
      applyDraft((draft) => {
        draft.flow.schema = schema;
        draft.flow.startNodeId = schema.initialState || draft.flow.startNodeId;
        syncNodesFromSchema(draft.flow, schema);
      }),

    addRule: (rule) =>
      applyDraft((draft) => {
        draft.rules[rule.ruleId] = rule;
      }),

    updateRule: (ruleId, patch) =>
      applyDraft((draft) => {
        const current = draft.rules[ruleId];
        if (!current) return;
        draft.rules[ruleId] = { ...current, ...patch };
      }),

    setRules: (rules) =>
      applyDraft((draft) => {
        draft.rules = rules;
      }),
  };
}

function upsertFlowState(schema: FlowSchema | undefined, id: string): FlowSchema {
  const base: FlowSchema =
    schema ?? {
      version: '1.0.0',
      flowId: 'flow',
      initialState: id,
      states: {},
    };
  if (!base.states[id]) {
    base.states[id] = { uiPageId: id, on: {} };
  }
  if (!base.initialState) base.initialState = id;
  return base;
}

function syncNodesFromSchema(flow: BuilderState['flow'], schema: FlowSchema) {
  const ids = Object.keys(schema.states);
  flow.nodes = ids.map((id, idx) => ({
    id,
    position: { x: 80 + (idx % 4) * 240, y: 80 + Math.floor(idx / 4) * 180 },
    label: id,
  }));
  const edges: FlowEdge[] = [];
  for (const [stateId, state] of Object.entries(schema.states)) {
    for (const [event, transition] of Object.entries(state.on)) {
      edges.push({
        id: `${stateId}-${event}-${transition.target}`,
        from: stateId,
        to: transition.target,
        onEvent: event,
        guardRuleId: transition.guard as string | undefined,
      });
    }
  }
  flow.edges = edges;
}
