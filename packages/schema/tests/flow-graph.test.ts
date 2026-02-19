import { describe, expect, it } from 'vitest';
import {
  createFlowGraph,
  createFlowScreen,
  createFlowTransition,
  flowGraphToStateMachine,
  stateMachineToFlowGraph,
  upsertFlowTransition,
} from '../src';

describe('flow graph helpers', () => {
  it('creates a flow graph with screens and transitions', () => {
    const screenA = createFlowScreen({ id: 'screen-a', title: 'Welcome', uiPageId: 'welcome-page' });
    const screenB = createFlowScreen({ id: 'screen-b', title: 'Details', uiPageId: 'details-page' });

    const flow = createFlowGraph({
      flowId: 'demo-flow',
      screens: [screenA, screenB],
      initialScreenId: screenA.id,
      transitions: [],
    });

    const withTransition = upsertFlowTransition(
      flow,
      createFlowTransition({
        id: 'transition-1',
        from: screenA.id,
        to: screenB.id,
        onEvent: 'next',
        condition: 'rule:EligibilityPassed',
      }),
    );

    expect(withTransition.screens).toHaveLength(2);
    expect(withTransition.transitions).toHaveLength(1);
    expect(withTransition.transitions[0]?.condition).toBe('rule:EligibilityPassed');
  });

  it('converts flow graph to legacy state machine shape', () => {
    const flow = createFlowGraph({
      flowId: 'demo-flow',
      screens: [
        createFlowScreen({ id: 'screen-a', title: 'Welcome', uiPageId: 'welcome-page' }),
        createFlowScreen({ id: 'screen-b', title: 'Details', uiPageId: 'details-page' }),
      ],
      initialScreenId: 'screen-a',
      transitions: [
        createFlowTransition({
          id: 'transition-1',
          from: 'screen-a',
          to: 'screen-b',
          onEvent: 'next',
          condition: 'rule:EligibilityPassed',
        }),
      ],
    });

    const legacy = flowGraphToStateMachine(flow);
    expect(legacy.initialState).toBe('screen-a');
    expect(legacy.states['screen-a']?.on.next?.target).toBe('screen-b');
    expect(legacy.states['screen-a']?.on.next?.condition).toBe('rule:EligibilityPassed');
  });

  it('converts legacy state machine shape to graph model', () => {
    const graph = stateMachineToFlowGraph({
      version: '1.0.0',
      flowId: 'legacy-flow',
      initialState: 'start',
      states: {
        start: {
          uiPageId: 'start-page',
          on: {
            next: {
              target: 'review',
              condition: 'rule:CanProceed',
            },
          },
        },
        review: {
          uiPageId: 'review-page',
          on: {},
        },
      },
    });

    expect(graph.initialScreenId).toBe('start');
    expect(graph.screens).toHaveLength(2);
    expect(graph.transitions[0]?.from).toBe('start');
    expect(graph.transitions[0]?.to).toBe('review');
    expect(graph.transitions[0]?.condition).toBe('rule:CanProceed');
  });
});
