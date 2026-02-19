import { getDefaultComponentCatalog } from '@platform/component-system';
import { flowGraphToStateMachine } from '@platform/schema';
import { BuilderShell, type BuilderPaletteEntry } from '../components/BuilderShell';
import { summarizeBuilderWorkspace } from '../lib/builder-modules';
import { createInitialBuilderFlowState } from '../lib/flow-engine';

const catalog = getDefaultComponentCatalog();

export default function Page() {
  const initialFlowState = createInitialBuilderFlowState();
  const flowStateMachine = flowGraphToStateMachine(initialFlowState.flow);
  const summary = summarizeBuilderWorkspace(flowStateMachine, catalog);

  const paletteEntries: BuilderPaletteEntry[] = [
    {
      id: 'palette-layout-section',
      kind: 'section',
      type: 'layout.section',
      displayName: 'Section',
      category: 'layout',
      description: 'Top-level layout group',
    },
    {
      id: 'palette-layout-row',
      kind: 'row',
      type: 'layout.row',
      displayName: 'Row',
      category: 'layout',
      description: 'Horizontal container for columns',
    },
    ...catalog.map((component) => ({
      id: `palette-${component.type}`,
      kind: 'component' as const,
      type: component.type,
      displayName: component.displayName,
      category: component.category,
      description: component.description ?? `Add ${component.displayName}`,
    })),
  ];

  return (
    <BuilderShell
      summary={summary}
      paletteEntries={paletteEntries}
      componentContracts={catalog}
      initialFlowState={initialFlowState}
    />
  );
}
