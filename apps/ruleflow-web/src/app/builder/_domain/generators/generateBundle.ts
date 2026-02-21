import type { BuilderState } from '../types';

export function generateApplicationBundle(state: BuilderState) {
  return {
    meta: state.metadata,
    screens: state.screens,
    flow: state.flow,
    rules: Object.values(state.rules),
  };
}
