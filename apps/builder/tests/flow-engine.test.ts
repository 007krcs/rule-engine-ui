import { describe, expect, it } from 'vitest';
import {
  addBuilderScreen,
  addBuilderTransition,
  createInitialBuilderFlowState,
  deleteBuilderTransition,
  removeBuilderScreen,
  updateBuilderTransition,
} from '../src/lib/flow-engine';

describe('flow engine', () => {
  it('creates an initial builder flow state with one screen and schema', () => {
    const state = createInitialBuilderFlowState();
    expect(state.flow.screens).toHaveLength(1);
    expect(state.activeScreenId).toBe(state.flow.screens[0]?.id);
    expect(Object.keys(state.schemasByScreenId)).toContain(state.activeScreenId);
  });

  it('adds and removes screens while keeping schemas in sync', () => {
    const initial = createInitialBuilderFlowState();
    const added = addBuilderScreen(initial.flow, initial.schemasByScreenId, 'Eligibility');
    expect(added.flow.screens).toHaveLength(2);
    expect(Object.keys(added.schemasByScreenId)).toHaveLength(2);

    const removed = removeBuilderScreen(added.flow, added.schemasByScreenId, added.newScreenId);
    expect(removed.flow.screens).toHaveLength(1);
    expect(Object.keys(removed.schemasByScreenId)).toHaveLength(1);
  });

  it('adds and updates conditional transitions', () => {
    const initial = createInitialBuilderFlowState();
    const withSecondScreen = addBuilderScreen(initial.flow, initial.schemasByScreenId, 'Review');
    const from = initial.activeScreenId;
    const to = withSecondScreen.newScreenId;

    const transition = addBuilderTransition(withSecondScreen.flow, {
      from,
      to,
      onEvent: 'submit',
      condition: 'rule:EligibilityPassed',
    });

    expect(transition.flow.transitions).toHaveLength(1);
    expect(transition.flow.transitions[0]?.condition).toBe('rule:EligibilityPassed');

    const updated = updateBuilderTransition(transition.flow, transition.transitionId, {
      condition: 'rule:ManualReviewRequired',
      onEvent: 'route',
    });
    expect(updated.transitions[0]?.onEvent).toBe('route');
    expect(updated.transitions[0]?.condition).toBe('rule:ManualReviewRequired');

    const deleted = deleteBuilderTransition(updated, transition.transitionId);
    expect(deleted.transitions).toHaveLength(0);
  });
});
