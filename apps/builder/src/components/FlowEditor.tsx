import React, { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { FlowGraphSchema, FlowScreenNode, FlowTransitionEdge } from '@platform/schema';
import styles from './FlowEditor.module.css';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 112;

interface CanvasPoint {
  x: number;
  y: number;
}

interface DraftConnection {
  fromScreenId: string;
  pointer: CanvasPoint;
}

interface DraftNodeDrag {
  screenId: string;
  pointerOffset: CanvasPoint;
}

export interface FlowEditorProps {
  flow: FlowGraphSchema;
  activeScreenId: string;
  selectedScreenId: string | null;
  selectedTransitionId: string | null;
  onSelectScreen: (screenId: string) => void;
  onSetActiveScreen: (screenId: string) => void;
  onSelectTransition: (transitionId: string) => void;
  onCreateTransition: (input: { from: string; to: string }) => void;
  onMoveScreen: (input: { screenId: string; position: CanvasPoint }) => void;
}

export function FlowEditor({
  flow,
  activeScreenId,
  selectedScreenId,
  selectedTransitionId,
  onSelectScreen,
  onSetActiveScreen,
  onSelectTransition,
  onCreateTransition,
  onMoveScreen,
}: FlowEditorProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [draftConnection, setDraftConnection] = useState<DraftConnection | null>(null);
  const [draftNodeDrag, setDraftNodeDrag] = useState<DraftNodeDrag | null>(null);

  const screenLayout = useMemo(
    () =>
      flow.screens.map((screen, index) => ({
        screen,
        position: resolveScreenPosition(screen, index),
      })),
    [flow.screens],
  );

  const screenById = useMemo(() => {
    const map = new Map<string, { screen: FlowScreenNode; position: CanvasPoint }>();
    for (const layout of screenLayout) {
      map.set(layout.screen.id, layout);
    }
    return map;
  }, [screenLayout]);

  useEffect(() => {
    if (!draftConnection && !draftNodeDrag) {
      return;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (draftConnection) {
        setDraftConnection((current) => {
          if (!current) return null;
          const nextPointer = toCanvasPoint(boardRef.current, event.clientX, event.clientY);
          if (!nextPointer) return current;
          return {
            ...current,
            pointer: nextPointer,
          };
        });
      }

      if (draftNodeDrag) {
        const pointer = toCanvasPoint(boardRef.current, event.clientX, event.clientY);
        if (!pointer) return;
        onMoveScreen({
          screenId: draftNodeDrag.screenId,
          position: {
            x: pointer.x - draftNodeDrag.pointerOffset.x,
            y: pointer.y - draftNodeDrag.pointerOffset.y,
          },
        });
      }
    };

    const handleMouseUp = () => {
      setDraftConnection(null);
      setDraftNodeDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draftConnection, draftNodeDrag, onMoveScreen]);

  const canvasWidth = Math.max(920, ...screenLayout.map((layout) => layout.position.x + NODE_WIDTH + 120));
  const canvasHeight = Math.max(560, ...screenLayout.map((layout) => layout.position.y + NODE_HEIGHT + 120));

  const handleConnectionStart = (screenId: string) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const pointer = toCanvasPoint(boardRef.current, event.clientX, event.clientY);
    if (!pointer) {
      return;
    }
    onSelectScreen(screenId);
    setDraftConnection({
      fromScreenId: screenId,
      pointer,
    });
  };

  const handleConnectionEnd = (targetScreenId: string) => (event: MouseEvent<HTMLButtonElement>) => {
    if (!draftConnection) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const fromScreenId = draftConnection.fromScreenId;
    setDraftConnection(null);
    if (fromScreenId === targetScreenId) {
      return;
    }
    onCreateTransition({
      from: fromScreenId,
      to: targetScreenId,
    });
  };

  const handleScreenDragStart = (screenId: string) => (event: MouseEvent<HTMLElement>) => {
    const boardPoint = toCanvasPoint(boardRef.current, event.clientX, event.clientY);
    const screen = screenById.get(screenId);
    if (!boardPoint || !screen) return;
    event.preventDefault();
    const pointerOffset = {
      x: boardPoint.x - screen.position.x,
      y: boardPoint.y - screen.position.y,
    };
    setDraftNodeDrag({
      screenId,
      pointerOffset,
    });
  };

  return (
    <section className={styles.flowRoot} aria-label="Flow builder">
      <header className={styles.flowHeader}>
        <h2>Flow Editor</h2>
        <p>Drag from a source handle to a target handle to create transitions between screens.</p>
      </header>
      <div className={styles.flowViewport} role="region" aria-label="Flow graph viewport">
        <div ref={boardRef} className={styles.flowBoard} style={{ width: canvasWidth, height: canvasHeight }}>
          <svg width={canvasWidth} height={canvasHeight} className={styles.edgeLayer} aria-hidden="true">
            <defs>
              <marker id="flow-editor-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" className={styles.edgeArrow} />
              </marker>
            </defs>
            {flow.transitions.map((transition) => {
              const geometry = createEdgeGeometry(transition, screenById);
              if (!geometry) {
                return null;
              }
              const selected = selectedTransitionId === transition.id;
              return (
                <g key={transition.id}>
                  <path
                    d={geometry.path}
                    className={[styles.edgePath, selected ? styles.edgePathSelected : ''].join(' ')}
                    markerEnd="url(#flow-editor-arrow)"
                    onClick={() => onSelectTransition(transition.id)}
                  />
                  <text x={geometry.labelX} y={geometry.labelY} className={styles.edgeLabel}>
                    {buildTransitionLabel(transition)}
                  </text>
                </g>
              );
            })}
            {draftConnection ? (
              <path
                d={buildDraftPath(draftConnection, screenById)}
                className={styles.edgeDraft}
                markerEnd="url(#flow-editor-arrow)"
              />
            ) : null}
          </svg>

          {screenLayout.map(({ screen, position }) => {
            const selected = selectedScreenId === screen.id;
            const active = activeScreenId === screen.id;
            return (
              <article
                key={screen.id}
                className={[styles.screenNode, selected ? styles.screenNodeSelected : '', active ? styles.screenNodeActive : ''].join(' ')}
                style={{ left: position.x, top: position.y }}
                onClick={() => onSelectScreen(screen.id)}
                aria-label={`Flow screen ${screen.title}`}
              >
                <header className={styles.screenHeader}>
                  <h3>{screen.title}</h3>
                  {active ? <span className={styles.activePill}>Active</span> : null}
                </header>
                <p>{screen.id}</p>
                <small>{screen.uiPageId}</small>
                <button
                  type="button"
                  className={styles.dragButton}
                  onMouseDown={handleScreenDragStart(screen.id)}
                  aria-label={`Drag ${screen.title} to reposition`}
                >
                  Drag
                </button>
                <div className={styles.nodeActions}>
                  <button
                    type="button"
                    className={styles.handleButton}
                    onMouseDown={handleConnectionStart(screen.id)}
                    aria-label={`Start transition from ${screen.title}`}
                  >
                    Source
                  </button>
                  <button
                    type="button"
                    className={styles.handleButton}
                    onMouseUp={handleConnectionEnd(screen.id)}
                    aria-label={`Connect transition into ${screen.title}`}
                  >
                    Target
                  </button>
                </div>
                <button
                  type="button"
                  className={styles.setActiveButton}
                  onClick={() => onSetActiveScreen(screen.id)}
                >
                  Edit Screen Layout
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function resolveScreenPosition(screen: FlowScreenNode, index: number): CanvasPoint {
  if (screen.position) {
    return {
      x: screen.position.x,
      y: screen.position.y,
    };
  }
  return {
    x: 80 + (index % 3) * 280,
    y: 100 + Math.floor(index / 3) * 200,
  };
}

function toCanvasPoint(
  container: HTMLDivElement | null,
  clientX: number,
  clientY: number,
): CanvasPoint | null {
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function createEdgeGeometry(
  transition: FlowTransitionEdge,
  screenById: Map<string, { screen: FlowScreenNode; position: CanvasPoint }>,
): {
  path: string;
  labelX: number;
  labelY: number;
} | null {
  const from = screenById.get(transition.from);
  const to = screenById.get(transition.to);
  if (!from || !to) {
    return null;
  }

  const startX = from.position.x + NODE_WIDTH;
  const startY = from.position.y + NODE_HEIGHT / 2;
  const endX = to.position.x;
  const endY = to.position.y + NODE_HEIGHT / 2;
  const controlOffset = Math.max(80, Math.abs(endX - startX) / 2);
  const path = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;

  return {
    path,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 - 8,
  };
}

function buildDraftPath(
  draft: DraftConnection,
  screenById: Map<string, { screen: FlowScreenNode; position: CanvasPoint }>,
): string {
  const source = screenById.get(draft.fromScreenId);
  if (!source) {
    return '';
  }

  const startX = source.position.x + NODE_WIDTH;
  const startY = source.position.y + NODE_HEIGHT / 2;
  const endX = draft.pointer.x;
  const endY = draft.pointer.y;
  const controlOffset = Math.max(70, Math.abs(endX - startX) / 2);
  return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
}

function buildTransitionLabel(transition: FlowTransitionEdge): string {
  if (typeof transition.condition === 'string' && transition.condition.trim().length > 0) {
    return `${transition.onEvent} [${transition.condition}]`;
  }
  return transition.onEvent;
}
