import type { BuilderState } from './types';

type CacheEntry<T> = {
  state: BuilderState;
  value: T;
};

export function createMemoizedSelector<T>(select: (state: BuilderState) => T): (state: BuilderState) => T {
  let cache: CacheEntry<T> | null = null;
  return (state) => {
    if (cache && cache.state === state) {
      return cache.value;
    }
    const value = select(state);
    cache = { state, value };
    return value;
  };
}

export const selectRulesList = createMemoizedSelector((state) =>
  Object.values(state.rules).sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
);

export const selectActiveScreenSchema = createMemoizedSelector((state) => {
  if (!state.activeScreenId) return null;
  return state.screens[state.activeScreenId] ?? null;
});

export const selectCanvasStats = createMemoizedSelector((state) => ({
  screenCount: Object.keys(state.screens).length,
  edgeCount: state.flow.edges.length,
  nodeCount: state.flow.nodes.length,
  ruleCount: Object.keys(state.rules).length,
}));
