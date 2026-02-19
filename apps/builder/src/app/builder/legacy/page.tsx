/* Legacy builder experience mounted under /builder/legacy */
'use client';

import React, { useMemo } from 'react';
import { BuilderShell } from '../../../components/BuilderShell';
import { getBuilderComponentCatalog } from '../../../lib/plugin-host';
import { summarizeBuilderWorkspace } from '../../../lib/builder-modules';
import { createInitialBuilderFlowState } from '../../../lib/flow-engine';
import { WorkspaceHeader } from '../../../components/WorkspaceHeader';
import type { BuilderPaletteEntry } from '../../../components/BuilderShell';

export default function LegacyBuilderPage() {
  const initialFlowState = useMemo(() => createInitialBuilderFlowState(), []);
  const componentContracts = useMemo(() => getBuilderComponentCatalog(), []);

  const summary = useMemo(
    () =>
      summarizeBuilderWorkspace(
        {
          states: Object.fromEntries(
            initialFlowState.flow.screens.map((screen) => [screen.id, { uiPageId: screen.uiPageId }]),
          ),
        },
        componentContracts,
      ),
    [componentContracts, initialFlowState.flow.screens],
  );

  const paletteEntries: BuilderPaletteEntry[] = useMemo(
    () =>
      componentContracts.map((contract) => ({
        id: contract.type,
        kind: 'component',
        type: contract.type,
        displayName: contract.displayName ?? contract.type,
        category: contract.category ?? 'Components',
        description: contract.description,
      })),
    [componentContracts],
  );

  return (
    <div>
      <WorkspaceHeader
        title="Legacy Builder"
        subtitle="Canvas Workspace is still available here while the new console evolves."
      />
      <p>Canvas Workspace (Legacy)</p>
      <BuilderShell
        summary={summary}
        paletteEntries={paletteEntries}
        componentContracts={componentContracts}
        initialFlowState={initialFlowState}
      />
    </div>
  );
}
