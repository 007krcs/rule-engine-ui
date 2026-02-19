"use client";

import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type { ApiMapping, FlowSchema, RuleSet, UISchema } from '@platform/schema';
import { createEmptyRuleset } from '@platform/schema';

export interface BuilderState {
  appId: string;
  version: string;
  screens: Record<string, UISchema>;
  flow: FlowSchema;
  rules: RuleSet;
  apiMappings: ApiMapping[];
  tokens: Record<string, string>;
  plugins: string[];
}

type BuilderAction =
  | { type: 'SET_FLOW'; flow: FlowSchema }
  | { type: 'ADD_SCREEN'; id: string; schema: UISchema }
  | { type: 'UPDATE_SCREEN'; id: string; schema: UISchema }
  | { type: 'RENAME_SCREEN'; id: string; newId: string }
  | {
      type: 'ADD_TRANSITION';
      from: string;
      event: string;
      to: string;
      guard?: FlowSchema['states'][string]['on'][string]['guard'];
      actions?: FlowSchema['states'][string]['on'][string]['actions'];
      apiId?: string;
    }
  | { type: 'SET_RULES'; rules: RuleSet }
  | { type: 'ADD_RULE'; rule: RuleSet['rules'][number] }
  | { type: 'UPDATE_RULE'; ruleId: string; patch: Partial<RuleSet['rules'][number]> };

const defaultFlow: FlowSchema = {
  version: '1.0.0',
  states: {},
  flowId: '',
  initialState: '',
};

const initialState: BuilderState = {
  appId: 'builder-app',
  version: '0.1.0',
  screens: {},
  flow: defaultFlow,
  rules: createEmptyRuleset(),
  apiMappings: [],
  tokens: {},
  plugins: [],
};

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'SET_FLOW':
      return { ...state, flow: action.flow };
    case 'ADD_SCREEN':
    case 'UPDATE_SCREEN': {
      const nextFlow = ensureFlowStateForScreen(state.flow, action.id, action.schema.pageId);
      return {
        ...state,
        screens: { ...state.screens, [action.id]: action.schema },
        flow: nextFlow,
      };
    }
    case 'RENAME_SCREEN': {
      const { id, newId } = action;
      if (id === newId) return state;
      const { screens, flow } = state;
      const nextScreens = { ...screens };
      const screenSchema = nextScreens[id];
      if (screenSchema) {
        delete nextScreens[id];
        nextScreens[newId] = { ...screenSchema, pageId: newId };
      }

      const nextFlow: FlowSchema = { ...flow, states: { ...flow.states } };
      if (flow.states[id]) {
        nextFlow.states[newId] = { ...flow.states[id], uiPageId: newId };
        delete nextFlow.states[id];
      }
      if (nextFlow.initialState === id) {
        nextFlow.initialState = newId;
      }

      return { ...state, screens: nextScreens, flow: nextFlow };
    }
    case 'ADD_TRANSITION': {
      const { from, event, to, guard, actions, apiId } = action;
      const baseFlow = ensureFlowStateForScreen(state.flow, from, from);
      const nextStates = {
        ...baseFlow.states,
        [from]: {
          uiPageId: baseFlow.states[from]?.uiPageId ?? from,
          on: {
            ...(baseFlow.states[from]?.on ?? {}),
            [event]: {
              target: to,
              guard,
              actions,
              apiId,
            },
          },
        },
      };
      return { ...state, flow: { ...baseFlow, states: nextStates } };
    }
    case 'ADD_RULE': {
      return { ...state, rules: { ...state.rules, rules: [...state.rules.rules, action.rule] } };
    }
    case 'SET_RULES': {
      return { ...state, rules: action.rules };
    }
    case 'UPDATE_RULE': {
      const nextRules = state.rules.rules.map((rule) =>
        rule.ruleId === action.ruleId ? { ...rule, ...action.patch } : rule,
      );
      return { ...state, rules: { ...state.rules, rules: nextRules } };
    }
    default:
      return state;
  }
}

function ensureFlowStateForScreen(flow: FlowSchema, stateId: string, uiPageId: string): FlowSchema {
  if (flow.states[stateId]) return flow;
  const nextStates = {
    ...flow.states,
    [stateId]: {
      uiPageId,
      on: {},
    },
  };
  const nextInitial = flow.initialState || stateId;
  return {
    ...flow,
    states: nextStates,
    initialState: nextInitial,
  };
}

export const BuilderContext = createContext<{
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
} | null>(null);

export const builderInitialState = initialState;
export { builderReducer };

export function BuilderProvider({ children, initial }: { children: React.ReactNode; initial?: Partial<BuilderState> }) {
  const [state, dispatch] = useReducer(builderReducer, { ...initialState, ...initial });
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}

export function useBuilder() {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error('useBuilder must be used within BuilderProvider');
  return ctx;
}
