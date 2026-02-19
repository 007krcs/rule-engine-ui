import type { ComponentContract } from '@platform/component-contract';

type FlowShape = {
  states: Record<string, { uiPageId: string }>;
};

export interface BuilderWorkspaceSummary {
  stateCount: number;
  componentCount: number;
  componentTypes: string[];
}

export function summarizeBuilderWorkspace(
  flow: FlowShape,
  components: ComponentContract[],
): BuilderWorkspaceSummary {
  const uniqueTypes = new Set<string>();
  for (const component of components) {
    uniqueTypes.add(component.type);
  }

  return {
    stateCount: Object.keys(flow.states).length,
    componentCount: components.length,
    componentTypes: Array.from(uniqueTypes).sort(),
  };
}
