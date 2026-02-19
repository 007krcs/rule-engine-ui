
'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import { Button, Checkbox, Input, Select } from '@platform/component-system';
import type { ComponentContract, ComponentPropDefinition } from '@platform/component-contract';
import {
  serializeApplicationBundle,
  type ApplicationBundleStatus,
  type FlowTransitionEdge,
  type LayoutTreeNode,
  type JSONValue,
  type UIComponent,
  type UISchema,
} from '@platform/schema';
import type { BuilderWorkspaceSummary } from '../lib/builder-modules';
import { assembleBundle } from '../lib/application-bundle';
import {
  addBuilderScreen,
  addBuilderTransition,
  createInitialBuilderFlowState,
  deleteBuilderTransition,
  rebindBuilderScreenPage,
  removeBuilderScreen,
  renameBuilderScreen,
  updateBuilderTransition,
  type BuilderFlowState,
} from '../lib/flow-engine';
import {
  applyPaletteDrop,
  createInitialBuilderSchema,
  getComponentById,
  getLayoutNode,
  updateComponentProps,
  updateLayoutNodeProperties,
} from '../lib/layout-engine';
import { Canvas } from './Canvas';
import { FlowEditor } from './FlowEditor';
import {
  setPaletteDragItem,
  type DropTarget,
  type PaletteDragItem,
  type PaletteItemKind,
} from '../utils/DragDropManager';
import styles from './BuilderShell.module.css';

type BuilderMode = 'layout' | 'flow';

export interface BuilderPaletteEntry {
  id: string;
  kind: PaletteItemKind;
  type: string;
  displayName: string;
  category: string;
  description?: string;
}

export interface BuilderShellProps {
  summary: BuilderWorkspaceSummary;
  paletteEntries: BuilderPaletteEntry[];
  componentContracts: ComponentContract[];
  initialFlowState?: BuilderFlowState;
}

export function BuilderShell({
  summary,
  paletteEntries,
  componentContracts,
  initialFlowState = createInitialBuilderFlowState(),
}: BuilderShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [editMode, setEditMode] = useState(true);
  const [builderMode, setBuilderMode] = useState<BuilderMode>('layout');
  const [flowGraph, setFlowGraph] = useState(initialFlowState.flow);
  const [schemasByScreenId, setSchemasByScreenId] = useState<Record<string, UISchema>>(
    initialFlowState.schemasByScreenId,
  );
  const [activeScreenId, setActiveScreenId] = useState(initialFlowState.activeScreenId);
  const [selectedLayoutNodeByScreen, setSelectedLayoutNodeByScreen] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      Object.entries(initialFlowState.schemasByScreenId).map(([screenId, schema]) => [
        screenId,
        schema.sections?.[0]?.id ?? null,
      ]),
    ),
  );
  const [selectedFlowScreenId, setSelectedFlowScreenId] = useState<string | null>(initialFlowState.activeScreenId);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
  const [newScreenTitle, setNewScreenTitle] = useState('');
  const [transitionDraft, setTransitionDraft] = useState({
    from: initialFlowState.activeScreenId,
    to: initialFlowState.activeScreenId,
    onEvent: 'next',
    condition: '',
  });
  const [bundleConfigId, setBundleConfigId] = useState('ruleflow-builder-config');
  const [bundleTenantId, setBundleTenantId] = useState('tenant-default');
  const [bundleStatus, setBundleStatus] = useState<ApplicationBundleStatus>('DRAFT');
  const [bundleVersion, setBundleVersion] = useState(1);
  const [bundleCreatedAt] = useState(() => new Date().toISOString());
  const [bundleUpdatedAt, setBundleUpdatedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    if (flowGraph.screens.some((screen) => screen.id === activeScreenId)) return;
    const fallback = flowGraph.screens[0]?.id;
    if (!fallback) return;
    setActiveScreenId(fallback);
    setSelectedFlowScreenId(fallback);
  }, [flowGraph.screens, activeScreenId]);

  useEffect(() => {
    const fallback = flowGraph.screens[0]?.id;
    if (!fallback) return;
    setTransitionDraft((current) => ({
      ...current,
      from: flowGraph.screens.some((screen) => screen.id === current.from) ? current.from : fallback,
      to: flowGraph.screens.some((screen) => screen.id === current.to) ? current.to : fallback,
    }));
  }, [flowGraph.screens]);

  useEffect(() => {
    setBundleUpdatedAt(new Date().toISOString());
  }, [flowGraph, schemasByScreenId]);

  const activeScreen = useMemo(
    () => flowGraph.screens.find((screen) => screen.id === activeScreenId) ?? flowGraph.screens[0] ?? null,
    [flowGraph.screens, activeScreenId],
  );

  const activeSchema = useMemo(() => {
    if (!activeScreen) return createInitialBuilderSchema('screen-page');
    return schemasByScreenId[activeScreen.id] ?? createInitialBuilderSchema(activeScreen.uiPageId);
  }, [activeScreen, schemasByScreenId]);

  const selectedLayoutNodeId = useMemo(() => {
    if (!activeScreen) return null;
    return selectedLayoutNodeByScreen[activeScreen.id] ?? activeSchema.sections?.[0]?.id ?? null;
  }, [activeSchema, activeScreen, selectedLayoutNodeByScreen]);

  const selectedLayoutNode = useMemo(
    () => getLayoutNode(activeSchema, selectedLayoutNodeId),
    [activeSchema, selectedLayoutNodeId],
  );

  const contractByType = useMemo(
    () => new Map(componentContracts.map((contract) => [contract.type, contract])),
    [componentContracts],
  );

  const selectedComponent = useMemo(() => {
    if (!selectedLayoutNode || selectedLayoutNode.kind !== 'component') return null;
    return getComponentById(activeSchema, selectedLayoutNode.componentId) ?? null;
  }, [activeSchema, selectedLayoutNode]);

  const selectedComponentContract = useMemo(() => {
    if (!selectedComponent) return null;
    return contractByType.get(selectedComponent.type) ?? null;
  }, [contractByType, selectedComponent]);

  const selectedFlowScreen = useMemo(() => {
    const lookupId = selectedFlowScreenId ?? activeScreen?.id ?? null;
    if (!lookupId) return null;
    return flowGraph.screens.find((screen) => screen.id === lookupId) ?? null;
  }, [activeScreen?.id, flowGraph.screens, selectedFlowScreenId]);

  const selectedTransition = useMemo(
    () => flowGraph.transitions.find((transition) => transition.id === selectedTransitionId) ?? null,
    [flowGraph.transitions, selectedTransitionId],
  );

  const applicationBundle = useMemo(
    () =>
      assembleBundle({
        flowGraph,
        uiSchemasByScreenId: schemasByScreenId,
        configId: bundleConfigId,
        tenantId: bundleTenantId,
        version: bundleVersion,
        status: bundleStatus,
        createdAt: bundleCreatedAt,
        updatedAt: bundleUpdatedAt,
        rules: {
          version: '1.0.0',
          rules: [],
        },
        apiMappings: [],
        themes: {
          id: 'builder-default',
          name: 'Builder Default Theme',
          tokens: {
            'color.surface': '#ffffff',
            'color.text.primary': '#10243f',
            'radius.md': '12px',
          },
        },
      }),
    [
      flowGraph,
      schemasByScreenId,
      bundleConfigId,
      bundleTenantId,
      bundleVersion,
      bundleStatus,
      bundleCreatedAt,
      bundleUpdatedAt,
    ],
  );

  const legacyFlowStateMachine = applicationBundle.flowSchema;

  const sortedPalette = useMemo(
    () =>
      [...paletteEntries].sort(
        (left, right) =>
          left.category.localeCompare(right.category) || left.displayName.localeCompare(right.displayName),
      ),
    [paletteEntries],
  );

  const handleSelectScreen = (screenId: string) => {
    setActiveScreenId(screenId);
    setSelectedFlowScreenId(screenId);
    setTransitionDraft((current) => ({ ...current, from: screenId, to: current.to || screenId }));
  };

  const handlePaletteDrop = (target: DropTarget, item: PaletteDragItem) => {
    if (!activeScreen) return;
    const currentSchema = schemasByScreenId[activeScreen.id] ?? createInitialBuilderSchema(activeScreen.uiPageId);
    const selectedNodeId = selectedLayoutNodeByScreen[activeScreen.id] ?? currentSchema.sections?.[0]?.id ?? null;
    const result = applyPaletteDrop(currentSchema, item, target, selectedNodeId, {
      getComponentContract: (type) => contractByType.get(type),
    });

    setSchemasByScreenId((current) => ({ ...current, [activeScreen.id]: result.schema }));
    if (result.changed) {
      setSelectedLayoutNodeByScreen((current) => ({ ...current, [activeScreen.id]: result.selectedNodeId }));
    }
  };

  const handlePaletteItemDragStart = (entry: BuilderPaletteEntry) => (event: DragEvent<HTMLButtonElement>) => {
    setPaletteDragItem(event.dataTransfer, {
      kind: entry.kind,
      type: entry.type,
      displayName: entry.displayName,
    });
  };

  const handlePaletteItemInsert = (entry: BuilderPaletteEntry) => {
    handlePaletteDrop(
      { kind: 'canvas' },
      {
        kind: entry.kind,
        type: entry.type,
        displayName: entry.displayName,
      },
    );
  };
  const handleAddScreen = () => {
    const result = addBuilderScreen(flowGraph, schemasByScreenId, newScreenTitle);
    setFlowGraph(result.flow);
    setSchemasByScreenId(result.schemasByScreenId);
    setActiveScreenId(result.newScreenId);
    setSelectedFlowScreenId(result.newScreenId);
    setSelectedLayoutNodeByScreen((current) => ({
      ...current,
      [result.newScreenId]: result.schemasByScreenId[result.newScreenId]?.sections?.[0]?.id ?? null,
    }));
    setTransitionDraft({ from: result.newScreenId, to: result.newScreenId, onEvent: 'next', condition: '' });
    setNewScreenTitle('');
  };

  const handleRemoveSelectedScreen = () => {
    const targetScreenId = selectedFlowScreen?.id ?? activeScreen?.id;
    if (!targetScreenId) return;
    const result = removeBuilderScreen(flowGraph, schemasByScreenId, targetScreenId);
    setFlowGraph(result.flow);
    setSchemasByScreenId(result.schemasByScreenId);
    setActiveScreenId(result.newScreenId);
    setSelectedFlowScreenId(result.newScreenId);
    setSelectedTransitionId(null);
    setSelectedLayoutNodeByScreen((current) => {
      const next = { ...current };
      delete next[targetScreenId];
      return next;
    });
  };

  const handleSelectLayoutNode = (nodeId: string) => {
    if (!activeScreen) return;
    setSelectedLayoutNodeByScreen((current) => ({ ...current, [activeScreen.id]: nodeId }));
  };

  const updateSelectedLayoutNode = (patch: {
    title?: string | undefined;
    label?: string | undefined;
    className?: string | undefined;
    span?: number | undefined;
    componentSpan?: number | undefined;
  }) => {
    if (!activeScreen || !selectedLayoutNodeId) return;
    const currentSchema = schemasByScreenId[activeScreen.id] ?? createInitialBuilderSchema(activeScreen.uiPageId);
    const nextSchema = updateLayoutNodeProperties(currentSchema, selectedLayoutNodeId, patch);
    setSchemasByScreenId((current) => ({ ...current, [activeScreen.id]: nextSchema }));
  };

  const updateSelectedComponentProp = (propKey: string, value: JSONValue | undefined) => {
    if (!activeScreen || !selectedComponent) return;
    const currentSchema = schemasByScreenId[activeScreen.id] ?? createInitialBuilderSchema(activeScreen.uiPageId);
    const nextSchema = updateComponentProps(currentSchema, selectedComponent.id, {
      [propKey]: value,
    });
    setSchemasByScreenId((current) => ({ ...current, [activeScreen.id]: nextSchema }));
  };

  const handleLayoutTextFieldChange =
    (field: 'title' | 'label' | 'className') => (event: ChangeEvent<HTMLInputElement>) => {
      updateSelectedLayoutNode({ [field]: event.target.value });
    };

  const handleLayoutNumberFieldChange =
    (field: 'span' | 'componentSpan') => (event: ChangeEvent<HTMLInputElement>) => {
      const rawValue = Number.parseInt(event.target.value, 10);
      updateSelectedLayoutNode({ [field]: Number.isFinite(rawValue) ? rawValue : undefined });
    };

  const handleFlowConnectionCreate = (input: { from: string; to: string }) => {
    const result = addBuilderTransition(flowGraph, { from: input.from, to: input.to, onEvent: 'next' });
    setFlowGraph(result.flow);
    setSelectedTransitionId(result.transitionId);
    setSelectedFlowScreenId(input.to);
  };

  const handleAddTransitionFromForm = () => {
    if (!transitionDraft.from || !transitionDraft.to) return;
    const result = addBuilderTransition(flowGraph, {
      from: transitionDraft.from,
      to: transitionDraft.to,
      onEvent: transitionDraft.onEvent,
      condition: transitionDraft.condition,
    });
    setFlowGraph(result.flow);
    setSelectedTransitionId(result.transitionId);
  };

  const handleTransitionPatch = (
    transitionId: string,
    patch: Partial<Pick<FlowTransitionEdge, 'from' | 'to' | 'onEvent' | 'condition'>>,
  ) => {
    setFlowGraph((current) => updateBuilderTransition(current, transitionId, patch));
  };

  const handleExportBundle = () => {
    const filename = `${applicationBundle.metadata.configId}.json`;
    const json = serializeApplicationBundle(applicationBundle, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const screensCount = flowGraph.screens.length;
  const transitionsCount = flowGraph.transitions.length;
  const sectionsCount = activeSchema.sections?.length ?? 0;
  const rowsCount = countRows(activeSchema.sections ?? []);
  const columnsCount = countColumns(activeSchema.sections ?? []);
  const componentsCount = countLayoutComponents(activeSchema.sections ?? []);

  return (
    <div className={styles.builderPage}>
      <header className={styles.topBar}>
        <div>
          <h1>Ruleflow Builder</h1>
          <p>Multi-screen layout editing with visual flow transitions and conditional routing.</p>
        </div>
        <div className={styles.topBarActions}>
          <div className={styles.modeTabs} role="tablist" aria-label="Builder mode">
            <button
              type="button"
              className={builderMode === 'layout' ? styles.modeTabActive : styles.modeTab}
              onClick={() => setBuilderMode('layout')}
              role="tab"
              aria-selected={builderMode === 'layout'}
            >
              Layout
            </button>
            <button
              type="button"
              className={builderMode === 'flow' ? styles.modeTabActive : styles.modeTab}
              onClick={() => setBuilderMode('flow')}
              role="tab"
              aria-selected={builderMode === 'flow'}
            >
              Flow
            </button>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPaletteOpen((current) => !current)}
            aria-controls="builder-palette"
            aria-expanded={paletteOpen}
          >
            {paletteOpen ? 'Hide Left Panel' : 'Show Left Panel'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setInspectorOpen((current) => !current)}
            aria-controls="builder-inspector"
            aria-expanded={inspectorOpen}
          >
            {inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditMode((current) => !current)}
            aria-pressed={!editMode}
          >
            {editMode ? 'Switch To Preview' : 'Switch To Edit'}
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={handleExportBundle}>
            Export Bundle JSON
          </Button>
        </div>
      </header>

      <div className={styles.workspace} data-palette-open={paletteOpen} data-inspector-open={inspectorOpen}>
        <aside
          id="builder-palette"
          className={`${styles.panel} ${styles.palettePanel}`}
          hidden={!paletteOpen}
          aria-label="Builder controls"
        >
          <h2>Screens</h2>
          <p>Each screen maps to one flow state and one editable UI page.</p>
          <ul className={styles.screenList}>
            {flowGraph.screens.map((screen) => (
              <li key={screen.id}>
                <button
                  type="button"
                  className={
                    screen.id === activeScreen?.id ? `${styles.screenButton} ${styles.screenButtonActive}` : styles.screenButton
                  }
                  onClick={() => handleSelectScreen(screen.id)}
                >
                  <span>{screen.title}</span>
                  <small>{screen.id}</small>
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.addRow}>
            <Input
              value={newScreenTitle}
              onChange={(event) => setNewScreenTitle(event.target.value)}
              placeholder="New screen title"
              aria-label="New screen title"
              size="sm"
            />
            <Button type="button" variant="primary" size="sm" onClick={handleAddScreen}>
              Add Screen
            </Button>
          </div>
          {builderMode === 'layout' ? (
            <>
              <h2>Palette</h2>
              <p>Drag items into the selected screen canvas or use Insert for keyboard-only editing.</p>
              <ul className={styles.paletteList}>
                {sortedPalette.map((entry) => (
                  <li key={entry.id}>
                    <div className={styles.paletteItem}>
                      <button
                        type="button"
                        className={styles.paletteItemButton}
                        draggable
                        onDragStart={handlePaletteItemDragStart(entry)}
                      >
                        <span>{entry.displayName}</span>
                        <small>{entry.category}</small>
                      </button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePaletteItemInsert(entry)}
                        aria-label={`Insert ${entry.displayName} at canvas root`}
                      >
                        Insert
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className={styles.flowTips}>
              <h2>Flow Tips</h2>
              <ul>
                <li>Use Source and Target handles to connect screens.</li>
                <li>Select an edge to edit event and condition.</li>
                <li>Use rule references like <code>rule:EligibilityPassed</code>.</li>
              </ul>
            </div>
          )}
        </aside>

        <main className={styles.canvasArea} aria-label="Builder main workspace">
          {builderMode === 'layout' ? (
            <Canvas
              schema={activeSchema}
              editMode={editMode}
              selectedNodeId={selectedLayoutNodeId}
              onSelectNode={handleSelectLayoutNode}
              onDropPaletteItem={handlePaletteDrop}
            />
          ) : (
            <FlowEditor
              flow={flowGraph}
              activeScreenId={activeScreen?.id ?? ''}
              selectedScreenId={selectedFlowScreen?.id ?? null}
              selectedTransitionId={selectedTransitionId}
              onSelectScreen={(screenId) => {
                setSelectedFlowScreenId(screenId);
                setSelectedTransitionId(null);
              }}
              onSetActiveScreen={(screenId) => {
                setActiveScreenId(screenId);
                setSelectedFlowScreenId(screenId);
                setBuilderMode('layout');
              }}
              onSelectTransition={(transitionId) => {
                setSelectedTransitionId(transitionId);
                const transition = flowGraph.transitions.find((candidate) => candidate.id === transitionId);
                if (transition) setSelectedFlowScreenId(transition.to);
              }}
              onCreateTransition={handleFlowConnectionCreate}
            />
          )}
        </main>

        <aside
          id="builder-inspector"
          className={`${styles.panel} ${styles.inspectorPanel}`}
          hidden={!inspectorOpen}
          aria-label="Properties panel"
        >
          <h2>Inspector</h2>
          <dl className={styles.summaryList}>
            <div><dt>Mode</dt><dd>{builderMode}</dd></div>
            <div><dt>Screens</dt><dd>{screensCount}</dd></div>
            <div><dt>Transitions</dt><dd>{transitionsCount}</dd></div>
            <div><dt>Sections</dt><dd>{sectionsCount}</dd></div>
            <div><dt>Rows</dt><dd>{rowsCount}</dd></div>
            <div><dt>Columns</dt><dd>{columnsCount}</dd></div>
            <div><dt>Layout Components</dt><dd>{componentsCount}</dd></div>
            <div><dt>Catalog Items</dt><dd>{summary.componentCount}</dd></div>
            <div><dt>Flow States</dt><dd>{Object.keys(legacyFlowStateMachine.states).length}</dd></div>
          </dl>

          <div className={styles.propertyPanel}>
            <h3>Bundle Metadata</h3>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <Input
                  id="bundle-config-id"
                  label="Config ID"
                  value={bundleConfigId}
                  onChange={(event) => setBundleConfigId(event.target.value)}
                  size="sm"
                />
              </div>
              <div className={styles.field}>
                <Input
                  id="bundle-tenant-id"
                  label="Tenant ID"
                  value={bundleTenantId}
                  onChange={(event) => setBundleTenantId(event.target.value)}
                  size="sm"
                />
              </div>
              <div className={styles.field}>
                <Input
                  id="bundle-version"
                  label="Bundle Version"
                  type="number"
                  min={1}
                  value={bundleVersion}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    setBundleVersion(Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
                  }}
                  size="sm"
                />
              </div>
              <div className={styles.field}>
                <Select
                  id="bundle-status"
                  label="Status"
                  value={bundleStatus}
                  onChange={(event) => setBundleStatus(event.target.value as ApplicationBundleStatus)}
                  size="sm"
                  options={[
                    { value: 'DRAFT', label: 'DRAFT' },
                    { value: 'PUBLISHED', label: 'PUBLISHED' },
                    { value: 'ARCHIVED', label: 'ARCHIVED' },
                  ]}
                />
              </div>
            </div>
          </div>

          {builderMode === 'layout' ? (
            <>
              <div className={styles.propertyPanel}>
                <h3>Layout Node Properties</h3>
                {selectedLayoutNode ? (
                  <LayoutPropertyFields
                    node={selectedLayoutNode}
                    onTextFieldChange={handleLayoutTextFieldChange}
                    onNumberFieldChange={handleLayoutNumberFieldChange}
                  />
                ) : (
                  <p className={styles.emptyNotice}>Select a section, row, column, or component node.</p>
                )}
              </div>
              {selectedLayoutNode?.kind === 'component' ? (
                <div className={styles.propertyPanel}>
                  <h3>Component Properties</h3>
                  {selectedComponent && selectedComponentContract ? (
                    <ComponentPropFields
                      component={selectedComponent}
                      contract={selectedComponentContract}
                      onPropChange={updateSelectedComponentProp}
                    />
                  ) : (
                    <p className={styles.emptyNotice}>No contract registered for this component type.</p>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className={styles.propertyPanel}>
                <h3>Screen Properties</h3>
                {selectedFlowScreen ? (
                  <div className={styles.fieldGroup}>
                    <div className={styles.field}>
                      <Input label="Screen ID" value={selectedFlowScreen.id} readOnly size="sm" />
                    </div>
                    <div className={styles.field}>
                      <Input
                        key={`screen-title-${selectedFlowScreen.id}`}
                        id="screen-title"
                        label="Screen Title"
                        defaultValue={selectedFlowScreen.title}
                        size="sm"
                        onBlur={(event) => setFlowGraph((current) => renameBuilderScreen(current, selectedFlowScreen.id, event.target.value))}
                      />
                    </div>
                    <div className={styles.field}>
                      <Input
                        key={`screen-page-${selectedFlowScreen.id}`}
                        id="screen-page"
                        label="UI Page ID"
                        defaultValue={selectedFlowScreen.uiPageId}
                        size="sm"
                        onBlur={(event) => {
                          const result = rebindBuilderScreenPage(flowGraph, schemasByScreenId, selectedFlowScreen.id, event.target.value);
                          setFlowGraph(result.flow);
                          setSchemasByScreenId(result.schemasByScreenId);
                        }}
                      />
                    </div>
                    <div className={styles.inlineActions}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setFlowGraph((current) => ({ ...current, initialScreenId: selectedFlowScreen.id }))}
                      >
                        Set As Initial
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={handleRemoveSelectedScreen}
                        disabled={flowGraph.screens.length <= 1}
                      >
                        Remove Screen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className={styles.emptyNotice}>Select a screen node from the flow graph.</p>
                )}
              </div>
              <div className={styles.propertyPanel}>
                <h3>Add Transition (Accessible)</h3>
                <div className={styles.fieldGroup}>
                  <div className={styles.field}>
                    <Select
                      id="transition-from"
                      label="From"
                      value={transitionDraft.from}
                      size="sm"
                      onChange={(event) => setTransitionDraft((current) => ({ ...current, from: event.target.value }))}
                      options={flowGraph.screens.map((screen) => ({ value: screen.id, label: screen.title }))}
                    />
                  </div>
                  <div className={styles.field}>
                    <Select
                      id="transition-to"
                      label="To"
                      value={transitionDraft.to}
                      size="sm"
                      onChange={(event) => setTransitionDraft((current) => ({ ...current, to: event.target.value }))}
                      options={flowGraph.screens.map((screen) => ({ value: screen.id, label: screen.title }))}
                    />
                  </div>
                  <div className={styles.field}>
                    <Input
                      id="transition-event"
                      label="Event"
                      value={transitionDraft.onEvent}
                      size="sm"
                      onChange={(event) => setTransitionDraft((current) => ({ ...current, onEvent: event.target.value }))}
                    />
                  </div>
                  <div className={styles.field}>
                    <Input
                      id="transition-condition"
                      label="Condition"
                      value={transitionDraft.condition}
                      size="sm"
                      placeholder="rule:EligibilityPassed"
                      onChange={(event) => setTransitionDraft((current) => ({ ...current, condition: event.target.value }))}
                    />
                  </div>
                  <Button type="button" variant="primary" size="sm" onClick={handleAddTransitionFromForm}>
                    Add Transition
                  </Button>
                </div>
              </div>

              <div className={styles.propertyPanel}>
                <h3>Transitions</h3>
                {flowGraph.transitions.length === 0 ? (
                  <p className={styles.emptyNotice}>No transitions yet. Drag handles in the flow editor to connect screens.</p>
                ) : (
                  <ul className={styles.transitionList}>
                    {flowGraph.transitions.map((transition) => (
                      <li key={transition.id}>
                        <button
                          type="button"
                          className={transition.id === selectedTransitionId ? `${styles.transitionButton} ${styles.transitionButtonActive}` : styles.transitionButton}
                          onClick={() => { setSelectedTransitionId(transition.id); setSelectedFlowScreenId(transition.to); }}
                        >
                          <span>{transition.from} {'->'} {transition.to}</span>
                          <small>{transition.onEvent}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={styles.propertyPanel}>
                <h3>Selected Transition</h3>
                {selectedTransition ? (
                  <div className={styles.fieldGroup}>
                    <div className={styles.field}>
                      <Select
                        label="From"
                        value={selectedTransition.from}
                        size="sm"
                        onChange={(event) => handleTransitionPatch(selectedTransition.id, { from: event.target.value })}
                        options={flowGraph.screens.map((screen) => ({ value: screen.id, label: screen.title }))}
                      />
                    </div>
                    <div className={styles.field}>
                      <Select
                        label="To"
                        value={selectedTransition.to}
                        size="sm"
                        onChange={(event) => handleTransitionPatch(selectedTransition.id, { to: event.target.value })}
                        options={flowGraph.screens.map((screen) => ({ value: screen.id, label: screen.title }))}
                      />
                    </div>
                    <div className={styles.field}>
                      <Input
                        label="Event"
                        value={selectedTransition.onEvent}
                        size="sm"
                        onChange={(event) => handleTransitionPatch(selectedTransition.id, { onEvent: event.target.value })}
                      />
                    </div>
                    <div className={styles.field}>
                      <Input
                        label="Condition"
                        value={typeof selectedTransition.condition === 'string' ? selectedTransition.condition : ''}
                        size="sm"
                        placeholder="rule:EligibilityPassed"
                        onChange={(event) => handleTransitionPatch(selectedTransition.id, { condition: event.target.value })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setFlowGraph((current) => deleteBuilderTransition(current, selectedTransition.id));
                        setSelectedTransitionId(null);
                      }}
                    >
                      Remove Transition
                    </Button>
                  </div>
                ) : (
                  <p className={styles.emptyNotice}>Select a transition edge to edit event and condition.</p>
                )}
              </div>
            </>
          )}

          <div className={styles.schemaPanel}><h3>Active UISchema</h3><pre>{JSON.stringify(activeSchema, null, 2)}</pre></div>
          <div className={styles.schemaPanel}><h3>FlowGraph JSON</h3><pre>{JSON.stringify(flowGraph, null, 2)}</pre></div>
          <div className={styles.schemaPanel}><h3>Legacy Flow State Machine</h3><pre>{JSON.stringify(legacyFlowStateMachine, null, 2)}</pre></div>
          <div className={styles.schemaPanel}><h3>ApplicationBundle JSON</h3><pre>{JSON.stringify(applicationBundle, null, 2)}</pre></div>
        </aside>
      </div>
    </div>
  );
}

interface LayoutPropertyFieldsProps {
  node: LayoutTreeNode;
  onTextFieldChange: (field: 'title' | 'label' | 'className') => (event: ChangeEvent<HTMLInputElement>) => void;
  onNumberFieldChange: (field: 'span' | 'componentSpan') => (event: ChangeEvent<HTMLInputElement>) => void;
}

function LayoutPropertyFields({ node, onTextFieldChange, onNumberFieldChange }: LayoutPropertyFieldsProps) {
  return (
    <div className={styles.fieldGroup}>
      <div className={styles.field}>
        <Input label="Node Type" value={node.kind} readOnly size="sm" />
      </div>
      <div className={styles.field}>
        <Input label="Label" value={node.label ?? ''} onChange={onTextFieldChange('label')} size="sm" />
      </div>
      <div className={styles.field}>
        <Input
          label="Class Name"
          value={node.className ?? ''}
          onChange={onTextFieldChange('className')}
          size="sm"
        />
      </div>
      {node.kind === 'section' ? (
        <div className={styles.field}>
          <Input label="Section Title" value={node.title ?? ''} onChange={onTextFieldChange('title')} size="sm" />
        </div>
      ) : null}
      {node.kind === 'column' ? (
        <div className={styles.field}>
          <Input
            label="Column Span (1-12)"
            type="number"
            min={1}
            max={12}
            value={node.span ?? ''}
            onChange={onNumberFieldChange('span')}
            size="sm"
          />
        </div>
      ) : null}
      {node.kind === 'component' ? (
        <div className={styles.field}>
          <Input
            label="Component Span (1-12)"
            type="number"
            min={1}
            max={12}
            value={node.componentSpan ?? ''}
            onChange={onNumberFieldChange('componentSpan')}
            size="sm"
          />
        </div>
      ) : null}
    </div>
  );
}

interface ComponentPropFieldsProps {
  component: UIComponent;
  contract: ComponentContract;
  onPropChange: (propKey: string, value: JSONValue | undefined) => void;
}

function ComponentPropFields({ component, contract, onPropChange }: ComponentPropFieldsProps) {
  const entries = Object.entries(contract.props ?? {});
  if (entries.length === 0) {
    return <p className={styles.emptyNotice}>This component has no configurable properties.</p>;
  }

  const sortedEntries = entries.sort((left, right) => {
    const leftLabel = left[1]?.label ?? left[0];
    const rightLabel = right[1]?.label ?? right[0];
    return leftLabel.localeCompare(rightLabel);
  });

  return (
    <div className={styles.fieldGroup}>
      {sortedEntries.map(([propKey, definition]) => (
        <ComponentPropField
          key={propKey}
          propKey={propKey}
          definition={definition}
          component={component}
          onPropChange={onPropChange}
        />
      ))}
    </div>
  );
}

interface ComponentPropFieldProps {
  propKey: string;
  definition: ComponentPropDefinition;
  component: UIComponent;
  onPropChange: (propKey: string, value: JSONValue | undefined) => void;
}

function ComponentPropField({ propKey, definition, component, onPropChange }: ComponentPropFieldProps) {
  const rawValue = component.props?.[propKey] ?? definition.defaultValue;
  const editable = definition.editable !== false;

  if (definition.kind === 'boolean') {
    return (
      <div className={styles.field}>
        <Checkbox
          label={definition.label}
          helperText={definition.description}
          checked={Boolean(rawValue)}
          onChange={(event) => onPropChange(propKey, event.target.checked)}
          disabled={!editable}
        />
      </div>
    );
  }

  if (definition.kind === 'enum') {
    const value = typeof rawValue === 'string' ? rawValue : '';
    return (
      <div className={styles.field}>
        <Select
          label={definition.label}
          helperText={definition.description}
          value={value}
          size="sm"
          disabled={!editable}
          placeholder={definition.required ? undefined : 'Select option'}
          options={definition.options}
          onChange={(event) => {
            const nextValue = event.target.value;
            onPropChange(propKey, nextValue === '' ? undefined : nextValue);
          }}
        />
      </div>
    );
  }

  if (definition.kind === 'number') {
    const numericValue =
      typeof rawValue === 'number' && Number.isFinite(rawValue)
        ? rawValue
        : rawValue === undefined || rawValue === null
          ? ''
          : Number(rawValue);
    return (
      <div className={styles.field}>
        <Input
          label={definition.label}
          helperText={definition.description}
          type="number"
          value={Number.isFinite(numericValue as number) ? (numericValue as number) : ''}
          min={definition.min}
          max={definition.max}
          step={definition.step}
          size="sm"
          disabled={!editable}
          onChange={(event) => {
            const nextRaw = event.target.value;
            if (nextRaw === '') {
              onPropChange(propKey, undefined);
              return;
            }
            const parsed = Number(nextRaw);
            onPropChange(propKey, Number.isFinite(parsed) ? parsed : undefined);
          }}
        />
      </div>
    );
  }

  const stringValue = rawValue === undefined || rawValue === null ? '' : String(rawValue);
  return (
    <div className={styles.field}>
      <Input
        label={definition.label}
        helperText={definition.description}
        placeholder={definition.kind === 'string' ? definition.placeholder : undefined}
        value={stringValue}
        size="sm"
        disabled={!editable}
        onChange={(event) => onPropChange(propKey, event.target.value)}
      />
    </div>
  );
}

function countRows(sections: readonly LayoutTreeNode[]): number {
  let count = 0;
  for (const section of sections) {
    if (section.kind !== 'section') continue;
    count += section.rows.length;
    for (const row of section.rows) {
      for (const column of row.columns) count += countRows(column.children);
    }
  }
  return count;
}

function countColumns(sections: readonly LayoutTreeNode[]): number {
  let count = 0;
  for (const section of sections) {
    if (section.kind !== 'section') continue;
    for (const row of section.rows) {
      count += row.columns.length;
      for (const column of row.columns) count += countColumns(column.children);
    }
  }
  return count;
}

function countLayoutComponents(sections: readonly LayoutTreeNode[]): number {
  let count = 0;
  for (const section of sections) {
    if (section.kind !== 'section') continue;
    for (const row of section.rows) {
      for (const column of row.columns) {
        for (const child of column.children) count += child.kind === 'component' ? 1 : countLayoutComponents([child]);
      }
    }
  }
  return count;
}
