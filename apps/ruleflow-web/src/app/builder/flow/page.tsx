'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FlowSchema, FlowTransition } from '@platform/schema';
import { useSearchParams } from 'next/navigation';
import { apiGet, apiPatch } from '@/lib/demo/api-client';
import type { ConfigVersion } from '@/lib/demo/types';
import { normalizeUiPages } from '@/lib/demo/ui-pages';
import { hasBlockingIssues, normalizeFlowSchema, validateFlowBuilderSchema } from '@/lib/builder/flow-api-validators';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ConditionBuilder } from '@/components/rules/ConditionBuilder';
import {
  conditionFromRule,
  conditionToRule,
  createConditionGroupDraft,
  type ConditionDraft,
} from '@/components/rules/rule-visual-model';
import { useBuilderStore } from '../_domain/builderStore';
import styles from './flow-builder.module.scss';

type GetVersionResponse = { ok: true; version: ConfigVersion } | { ok: false; error: string };

type GuardEditor = {
  stateId: string;
  event: string;
  draft: ConditionDraft;
};

type NodePosition = {
  id: string;
  x: number;
  y: number;
};

const FLOW_ACTIONS = ['evaluateRules', 'callApi', 'setContext', 'navigate'] as const;
const NODE_WIDTH = 184;
const NODE_HEIGHT = 92;

function normalizeStateId(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'state';
}

function buildNodePositions(stateIds: string[]): NodePosition[] {
  if (stateIds.length === 0) return [];
  const columns = Math.max(1, Math.ceil(Math.sqrt(stateIds.length)));
  return stateIds.map((id, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      id,
      x: 60 + col * 240,
      y: 50 + row * 184,
    };
  });
}

function FlowBuilderInner() {
  const searchParams = useSearchParams();
  const versionId = searchParams.get('versionId');
  const { toast } = useToast();
  const flow = useBuilderStore((s) => s.flow);
  const setFlowSchema = useBuilderStore((s) => s.setFlowSchema);

  const [version, setVersion] = useState<ConfigVersion | null>(null);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [newStateId, setNewStateId] = useState('');
  const [guardEditor, setGuardEditor] = useState<GuardEditor | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const pageIds = useMemo(() => {
    if (!version) return [];
    const pages = normalizeUiPages({
      uiSchema: version.bundle.uiSchema,
      uiSchemasById: version.bundle.uiSchemasById,
      activeUiPageId: version.bundle.activeUiPageId,
      flowSchema: version.bundle.flowSchema,
    });
    return Object.keys(pages.uiSchemasById);
  }, [version]);

  const flowSchema = useMemo<FlowSchema>(() => flow.schema ?? { version: '1.0.0', flowId: 'flow', initialState: '', states: {} }, [flow.schema]);

  const flowDraft = useMemo(() => {
    const fallback = pageIds[0] ?? 'builder-preview';
    return normalizeFlowSchema(flowSchema, fallback);
  }, [flowSchema, pageIds]);

  const stateIds = useMemo(() => Object.keys(flowDraft.states), [flowDraft.states]);
  const selectedState = selectedStateId ? flowDraft.states[selectedStateId] ?? null : null;
  const nodePositions = useMemo(() => buildNodePositions(stateIds), [stateIds]);
  const nodeById = useMemo(() => new Map(nodePositions.map((node) => [node.id, node])), [nodePositions]);
  const validationIssues = useMemo(() => validateFlowBuilderSchema(flowDraft, pageIds), [flowDraft, pageIds]);
  const hasErrors = hasBlockingIssues(validationIssues);

  useEffect(() => {
    if (!versionId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await apiGet<GetVersionResponse>(`/api/config-versions/${encodeURIComponent(versionId)}`);
        if (!response.ok) throw new Error(response.error);
        if (cancelled) return;

        const pages = normalizeUiPages({
          uiSchema: response.version.bundle.uiSchema,
          uiSchemasById: response.version.bundle.uiSchemasById,
          activeUiPageId: response.version.bundle.activeUiPageId,
          flowSchema: response.version.bundle.flowSchema,
        });
        const fallback = Object.keys(pages.uiSchemasById)[0] ?? 'builder-preview';
        const normalizedFlow = normalizeFlowSchema(response.version.bundle.flowSchema, fallback);

        setVersion(response.version);
        setFlowSchema(normalizedFlow);
        setSelectedStateId(normalizedFlow.initialState);
        setDirty(false);
      } catch (error) {
        if (cancelled) return;
        toast({
          variant: 'error',
          title: 'Failed to load flow schema',
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [toast, versionId]);

  const setNextFlow = (nextFlow: FlowSchema) => {
    setFlowSchema(nextFlow);
    setDirty(true);
  };

  const updateSelectedState = (updater: (stateId: string, schema: FlowSchema) => FlowSchema) => {
    if (!selectedStateId) return;
    setNextFlow(updater(selectedStateId, flowDraft));
  };

  const addState = () => {
    const requested = normalizeStateId(newStateId || `state_${stateIds.length + 1}`);
    if (stateIds.includes(requested)) {
      toast({ variant: 'error', title: `State "${requested}" already exists.` });
      return;
    }
    const fallbackPageId = selectedState?.uiPageId ?? pageIds[0] ?? 'builder-preview';
    setNextFlow({
      ...flowDraft,
      states: {
        ...flowDraft.states,
        [requested]: {
          uiPageId: fallbackPageId,
          on: {},
        },
      },
    });
    setSelectedStateId(requested);
    setNewStateId('');
  };

  const deleteSelectedState = () => {
    if (!selectedStateId) return;
    if (stateIds.length <= 1) {
      toast({ variant: 'error', title: 'At least one state is required.' });
      return;
    }
    const nextStates = Object.fromEntries(
      Object.entries(flowDraft.states)
        .filter(([stateId]) => stateId !== selectedStateId)
        .map(([stateId, state]) => [
          stateId,
          {
            ...state,
            on: Object.fromEntries(
              Object.entries(state.on).filter(([, transition]) => transition.target !== selectedStateId),
            ),
          },
        ]),
    );
    const fallback = Object.keys(nextStates)[0];
    if (!fallback) return;
    setNextFlow({
      ...flowDraft,
      initialState: flowDraft.initialState === selectedStateId ? fallback : flowDraft.initialState,
      states: nextStates,
    });
    setSelectedStateId(fallback);
  };

  const addTransition = () => {
    updateSelectedState((stateId, schema) => {
      const state = schema.states[stateId];
      if (!state) return schema;
      let eventName = `event_${Object.keys(state.on).length + 1}`;
      while (state.on[eventName]) {
        eventName = `${eventName}_copy`;
      }
      return {
        ...schema,
        states: {
          ...schema.states,
          [stateId]: {
            ...state,
            on: {
              ...state.on,
              [eventName]: {
                target: schema.initialState || stateId,
                actions: [],
              },
            },
          },
        },
      };
    });
  };

  const renameTransition = (previousEvent: string, nextEventRaw: string) => {
    const nextEvent = nextEventRaw.trim();
    if (!nextEvent || nextEvent === previousEvent) return;
    updateSelectedState((stateId, schema) => {
      const state = schema.states[stateId];
      if (!state) return schema;
      if (state.on[nextEvent]) {
        toast({ variant: 'error', title: `Event "${nextEvent}" already exists.` });
        return schema;
      }
      const current = state.on[previousEvent];
      if (!current) return schema;
      const nextOn = { ...state.on };
      delete nextOn[previousEvent];
      nextOn[nextEvent] = current;
      return {
        ...schema,
        states: {
          ...schema.states,
          [stateId]: {
            ...state,
            on: nextOn,
          },
        },
      };
    });
  };

  const updateTransition = (
    event: string,
    updater: (transition: FlowSchema['states'][string]['on'][string]) => FlowSchema['states'][string]['on'][string],
  ) => {
    updateSelectedState((stateId, schema) => {
      const state = schema.states[stateId];
      const transition = state?.on[event];
      if (!state || !transition) return schema;
      return {
        ...schema,
        states: {
          ...schema.states,
          [stateId]: {
            ...state,
            on: {
              ...state.on,
              [event]: updater(transition),
            },
          },
        },
      };
    });
  };

  const removeTransition = (event: string) => {
    updateSelectedState((stateId, schema) => {
      const state = schema.states[stateId];
      if (!state || !state.on[event]) return schema;
      const nextOn = { ...state.on };
      delete nextOn[event];
      return {
        ...schema,
        states: {
          ...schema.states,
          [stateId]: {
            ...state,
            on: nextOn,
          },
        },
      };
    });
  };

  const save = async () => {
    if (!versionId) return;
    if (hasErrors) {
      toast({ variant: 'error', title: 'Fix validation errors before saving.' });
      return;
    }
    setSaving(true);
    try {
      const response = await apiPatch<{ ok: true } | { ok: false; error: string }>(
        `/api/config-versions/${encodeURIComponent(versionId)}/flow`,
        { flowSchema: flowDraft },
      );
      if (!response.ok) throw new Error(response.error);
      setDirty(false);
      toast({ variant: 'success', title: 'Flow schema saved.' });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to save flow schema',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const graphWidth = Math.max(720, ...nodePositions.map((node) => node.x + NODE_WIDTH + 90));
  const graphHeight = Math.max(340, ...nodePositions.map((node) => node.y + NODE_HEIGHT + 90));

  return (
    <div className={styles.page}>
      <Card>
        <CardHeader>
          <div className={styles.headerRow}>
            <div>
              <CardTitle>Flow Builder</CardTitle>
              <p className={styles.subtext}>Build states, transitions, guards, and actions visually.</p>
            </div>
            <div className={styles.headerActions}>
              <a className={styles.linkButton} href={versionId ? `/playground?versionId=${encodeURIComponent(versionId)}` : '/playground'}>
                Open Playground
              </a>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()} disabled={loading || saving}>
                Reload
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={loading || saving || !dirty || hasErrors} data-testid="flow-save-button">
                {saving ? 'Saving...' : 'Save Flow'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className={styles.workspace}>
        <Card className={styles.leftPane}>
          <CardHeader>
            <div className={styles.panelHeader}>
              <CardTitle>State Graph</CardTitle>
              <div className={styles.addStateRow}>
                <Input value={newStateId} onChange={(event) => setNewStateId(event.target.value)} placeholder="review" data-testid="flow-state-id-input" />
                <Button size="sm" onClick={addState} data-testid="flow-add-state-button">Add State</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className={styles.panelBody}>
            <div className={styles.field}>
              <label className="rfFieldLabel">Initial State</label>
              <Select value={flowDraft.initialState} onChange={(event) => setNextFlow({ ...flowDraft, initialState: event.target.value })} data-testid="flow-initial-state-select">
                {stateIds.map((stateId) => (
                  <option key={stateId} value={stateId}>{stateId}</option>
                ))}
              </Select>
            </div>
            <div className={styles.graphCanvas}>
              <svg width={graphWidth} height={graphHeight} className={styles.edgeLayer} aria-hidden="true">
                <defs>
                  <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M 0 0 L 8 4 L 0 8 z" className={styles.edgeArrow} />
                  </marker>
                </defs>
                {stateIds.flatMap((stateId) => {
                  const state = flowDraft.states[stateId];
                  const fromNode = nodeById.get(stateId);
                  if (!state || !fromNode) return [];
                  return Object.entries(state.on).map(([event, transition]) => {
                    const toNode = nodeById.get(transition.target);
                    if (!toNode) return null;
                    const startX = fromNode.x + NODE_WIDTH / 2;
                    const startY = fromNode.y + NODE_HEIGHT / 2;
                    const endX = toNode.x + NODE_WIDTH / 2;
                    const endY = toNode.y + NODE_HEIGHT / 2;
                    return (
                      <g key={`${stateId}-${event}-${transition.target}`}>
                        <line x1={startX} y1={startY} x2={endX} y2={endY} className={styles.edgeLine} markerEnd="url(#flow-arrow)" />
                        <text x={(startX + endX) / 2} y={(startY + endY) / 2 - 6} className={styles.edgeLabel}>{event}</text>
                      </g>
                    );
                  });
                })}
              </svg>
              {nodePositions.map((node) => {
                const selected = selectedStateId === node.id;
                const state = flowDraft.states[node.id];
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={selected ? `${styles.node} ${styles.nodeSelected}` : styles.node}
                    style={{ left: node.x, top: node.y }}
                    onClick={() => setSelectedStateId(node.id)}
                    data-testid={`flow-node-${node.id}`}
                  >
                    <span className={styles.nodeTitle}>{node.id}</span>
                    <span className={styles.nodeSubtitle}>{state?.uiPageId}</span>
                    {flowDraft.initialState === node.id ? <span className={styles.nodePill}>Initial</span> : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className={styles.rightPane}>
          <CardHeader>
            <CardTitle>State Editor</CardTitle>
          </CardHeader>
          <CardContent className={styles.panelBody}>
            {!selectedState ? (
              <p className={styles.emptyText}>Select a state from the graph.</p>
            ) : (
              <>
                <div className={styles.sectionHeader}>
                  <h3>{selectedStateId}</h3>
                  <Button size="sm" variant="outline" onClick={deleteSelectedState}>Delete State</Button>
                </div>
                <div className={styles.field}>
                  <label className="rfFieldLabel">UI Page</label>
                  <Select
                    value={selectedState.uiPageId}
                    onChange={(event) =>
                      updateSelectedState((stateId, schema) => {
                        const state = schema.states[stateId];
                        if (!state) return schema;
                        return {
                          ...schema,
                          states: {
                            ...schema.states,
                            [stateId]: { ...state, uiPageId: event.target.value, on: state.on ?? {} },
                          },
                        };
                      })
                    }
                  >
                    {pageIds.map((pageId) => (
                      <option key={pageId} value={pageId}>{pageId}</option>
                    ))}
                  </Select>
                </div>
                <div className={styles.sectionHeader}>
                  <h3>Transitions</h3>
                  <Button size="sm" variant="outline" onClick={addTransition} data-testid="flow-add-transition-button">Add Transition</Button>
                </div>
                {Object.entries(selectedState.on).length === 0 ? (
                  <p className={styles.emptyText}>No transitions yet.</p>
                ) : (
                  <div className={styles.transitions}>
                    {Object.entries(selectedState.on).map(([event, transition]) => (
                      <div key={event} className={styles.transitionCard}>
                        <div className={styles.transitionGrid}>
                          <div className={styles.field}>
                            <label className="rfFieldLabel">Event</label>
                            <Input defaultValue={event} onBlur={(eventInput) => renameTransition(event, eventInput.target.value)} data-testid={`flow-transition-event-${selectedStateId}-${event}`} />
                          </div>
                          <div className={styles.field}>
                            <label className="rfFieldLabel">Target</label>
                            <Select value={transition.target} onChange={(target) => updateTransition(event, (current) => ({ ...current, target: target.target.value }))} data-testid={`flow-transition-target-${selectedStateId}-${event}`}>
                              {stateIds.map((stateId) => (
                                <option key={stateId} value={stateId}>{stateId}</option>
                              ))}
                            </Select>
                          </div>
                          <div className={styles.field}>
                            <label className="rfFieldLabel">API Id</label>
                            <Input value={transition.apiId ?? ''} onChange={(next) => updateTransition(event, (current) => ({ ...current, apiId: next.target.value.trim() || undefined }))} placeholder="submitOrder" />
                          </div>
                        </div>
                        <div className={styles.actionRow}>
                          <div className={styles.actionChecks}>
                            {FLOW_ACTIONS.map((action) => {
                              const checked = transition.actions?.includes(action) ?? false;
                              return (
                                <label key={action} className={styles.checkLabel}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(check) =>
                                      updateTransition(event, (current) => {
                                        const existing = current.actions ?? [];
                                        const nextActions = check.target.checked
                                          ? Array.from(new Set([...existing, action]))
                                          : existing.filter((candidate) => candidate !== action);
                                        return { ...current, actions: nextActions };
                                      })
                                    }
                                  />
                                  {action}
                                </label>
                              );
                            })}
                          </div>
                          <div className={styles.inlineActions}>
                            <Button size="sm" variant="outline" onClick={() => setGuardEditor({ stateId: selectedStateId!, event, draft: transition.guard ? conditionFromRule(transition.guard) : createConditionGroupDraft('all') })}>
                              {transition.guard ? 'Edit Guard' : 'Add Guard'}
                            </Button>
                            {transition.guard ? (
                              <Button size="sm" variant="outline" onClick={() => updateTransition(event, (current) => ({ ...current, guard: undefined }))}>Clear Guard</Button>
                            ) : null}
                            <Button size="sm" variant="outline" onClick={() => removeTransition(event)}>Remove</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Validation</CardTitle>
        </CardHeader>
        <CardContent>
          {validationIssues.length === 0 ? (
            <p className={styles.validText}>No validation issues.</p>
          ) : (
            <ul className={styles.issueList}>
              {validationIssues.map((issue) => (
                <li key={`${issue.path}-${issue.message}`} className={issue.severity === 'error' ? styles.issueError : styles.issueWarn}>
                  <span className={styles.issuePath}>{issue.path || 'root'}</span>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {guardEditor ? (
        <div className={styles.guardOverlay} role="dialog" aria-modal="true">
          <div className={styles.guardDialog}>
            <div className={styles.guardHeader}>
              <h3>Guard Condition Builder</h3>
              <Button size="sm" variant="outline" onClick={() => setGuardEditor(null)}>Close</Button>
            </div>
            <p className={styles.subtext}>
              Editing <span className="rfCodeInline">{guardEditor.stateId}.{guardEditor.event}</span>
            </p>
            <ConditionBuilder value={guardEditor.draft} onChange={(nextDraft) => setGuardEditor({ ...guardEditor, draft: nextDraft })} />
            <div className={styles.guardActions}>
              <Button size="sm" variant="outline" onClick={() => setGuardEditor(null)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => {
                  updateSelectedState((stateId, schema) => {
                    if (stateId !== guardEditor.stateId) return schema;
                    const state = schema.states[stateId];
                    const current = state?.on[guardEditor.event];
                    if (!state || !current) return schema;
                    const nextTransition: FlowTransition = {
                      ...current,
                      guard: conditionToRule(guardEditor.draft),
                    };
                    return {
                      ...schema,
                      states: {
                        ...schema.states,
                        [stateId]: {
                          ...state,
                          on: {
                            ...state.on,
                            [guardEditor.event]: nextTransition,
                          },
                        },
                      },
                    };
                  });
                  setGuardEditor(null);
                }}
              >
                Apply Guard
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? <div className={styles.loadingMask}>Loading flow schema...</div> : null}
    </div>
  );
}

export default function FlowBuilderPage() {
  return <FlowBuilderInner />;
}
