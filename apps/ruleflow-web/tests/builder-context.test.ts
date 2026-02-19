import { describe, expect, it } from 'vitest';
import type { BuilderState } from '../src/context/BuilderContext';
import { builderReducer, builderInitialState } from '../src/context/BuilderContext';
import { generateBundleFromState } from '../src/lib/generateBundle';

function createScreen(id: string) {
  return {
    version: '1.0.0',
    pageId: id,
    layout: { type: 'vertical', children: [] },
  };
}

function freshState(): BuilderState {
  return {
    ...builderInitialState,
    screens: {},
    flow: { ...builderInitialState.flow, states: {}, initialState: '' },
    rules: { version: '1.0.0', rules: [] },
    apiMappings: [],
    tokens: {},
    plugins: [],
  };
}

describe('BuilderContext reducer', () => {
  it('renaming a screen updates flow state keys and initialState', () => {
    let state = freshState();
    state = builderReducer(state, { type: 'ADD_SCREEN', id: 'screen-1', schema: createScreen('screen-1') });
    expect(state.flow.states['screen-1']).toBeTruthy();
    expect(state.flow.initialState).toBe('screen-1');

    state = builderReducer(state, { type: 'RENAME_SCREEN', id: 'screen-1', newId: 'screen-renamed' });
    expect(state.flow.states['screen-1']).toBeUndefined();
    expect(state.flow.states['screen-renamed']).toBeTruthy();
    expect(state.flow.initialState).toBe('screen-renamed');
  });

  it('adds transitions onto flow states', () => {
    let state = freshState();
    state = builderReducer(state, { type: 'ADD_SCREEN', id: 'a', schema: createScreen('a') });
    state = builderReducer(state, { type: 'ADD_SCREEN', id: 'b', schema: createScreen('b') });

    state = builderReducer(state, {
      type: 'ADD_TRANSITION',
      from: 'a',
      event: 'next',
      to: 'b',
      actions: ['navigate'],
    });

    expect(state.flow.states['a']?.on?.next?.target).toBe('b');
    expect(state.flow.states['a']?.on?.next?.actions).toEqual(['navigate']);
  });

  it('serializes bundle from state', () => {
    let state = freshState();
    state = builderReducer(state, { type: 'ADD_SCREEN', id: 'landing', schema: createScreen('landing') });
    state = builderReducer(state, { type: 'ADD_TRANSITION', from: 'landing', event: 'next', to: 'landing' });

    const bundle = generateBundleFromState(state);
    expect(bundle.metadata.configId).toBe(state.appId);
    expect(bundle.uiSchemas.landing).toBeTruthy();
    expect(bundle.flowSchema.states.landing).toBeTruthy();
    expect(bundle.rules.rules).toHaveLength(0);
  });
});
