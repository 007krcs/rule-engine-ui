import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createFlowGraph, createFlowScreen } from '@platform/schema';
import { FlowEditor } from '../src/components/FlowEditor';

describe('FlowEditor', () => {
  it('emits screen move events when dragging nodes', () => {
    const screenOne = createFlowScreen({
      id: 'screen-1',
      title: 'Screen 1',
      uiPageId: 'screen-1-page',
      position: { x: 80, y: 100 },
    });
    const screenTwo = createFlowScreen({
      id: 'screen-2',
      title: 'Screen 2',
      uiPageId: 'screen-2-page',
      position: { x: 360, y: 100 },
    });
    const flow = createFlowGraph({
      flowId: 'test-flow',
      screens: [screenOne, screenTwo],
      initialScreenId: 'screen-1',
      transitions: [],
    });

    const onMoveScreen = vi.fn();

    render(
      <FlowEditor
        flow={flow}
        activeScreenId="screen-1"
        selectedScreenId={null}
        selectedTransitionId={null}
        onSelectScreen={() => undefined}
        onSetActiveScreen={() => undefined}
        onSelectTransition={() => undefined}
        onCreateTransition={() => undefined}
        onMoveScreen={onMoveScreen}
      />, 
    );

    fireEvent.mouseDown(screen.getByRole('button', { name: /drag screen 1 to reposition/i }), {
      clientX: 120,
      clientY: 130,
    });
    fireEvent.mouseMove(window, { clientX: 300, clientY: 260 });
    fireEvent.mouseUp(window);

    expect(onMoveScreen).toHaveBeenCalled();
    const moveCall = onMoveScreen.mock.calls[onMoveScreen.mock.calls.length - 1]?.[0];
    expect(moveCall.screenId).toBe('screen-1');
    expect(moveCall.position.x).toBeGreaterThan(200);
    expect(moveCall.position.y).toBeGreaterThan(200);
  });
});
