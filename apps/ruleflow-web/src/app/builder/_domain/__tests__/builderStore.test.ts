import { describe, expect, it } from 'vitest';
import { createUISchema } from '@platform/schema';
import { useBuilderStore } from '../builderStore';
import { generateApplicationBundle } from '../generators/generateBundle';
import { selectCanvasStats, selectRulesList } from '../selectors';

describe('builderStore', () => {
  it('addScreen adds entry and sets active', () => {
    const reset = useBuilderStore.getState();
    useBuilderStore.setState(reset, true);

    useBuilderStore.getState().addScreen('home', createUISchema({ pageId: 'home' }));
    const screens = useBuilderStore.getState().screens;
    expect(screens.home).toBeTruthy();
    expect(useBuilderStore.getState().activeScreenId).toBe('home');
  });

  it('removeScreen prunes flow nodes/edges', () => {
    useBuilderStore.setState(useBuilderStore.getState(), true);
    useBuilderStore.getState().addScreen('one');
    useBuilderStore.getState().addScreen('two');
    useBuilderStore.getState().updateFlow((flow) => ({
      ...flow,
      edges: [{ id: 'e1', from: 'one', to: 'two' }],
    }));

    useBuilderStore.getState().removeScreen('two');
    expect(useBuilderStore.getState().flow.edges.length).toBe(0);
    expect(useBuilderStore.getState().screens.two).toBeUndefined();
  });

  it('generate bundle returns combined state', () => {
    useBuilderStore.setState(useBuilderStore.getState(), true);
    useBuilderStore.getState().addScreen('a');
    const bundle = generateApplicationBundle(useBuilderStore.getState());
    expect(bundle.screens.a).toBeTruthy();
    expect(bundle.flow).toBeTruthy();
    expect(Array.isArray(bundle.rules)).toBe(true);
  });

  it('memoized selectors reuse values for unchanged state objects', () => {
    useBuilderStore.setState(useBuilderStore.getState(), true);
    useBuilderStore.getState().addScreen('a');
    const snapshot = useBuilderStore.getState();
    const statsA = selectCanvasStats(snapshot);
    const statsB = selectCanvasStats(snapshot);
    const rulesA = selectRulesList(snapshot);
    const rulesB = selectRulesList(snapshot);
    expect(statsA).toBe(statsB);
    expect(rulesA).toBe(rulesB);
  });
});
