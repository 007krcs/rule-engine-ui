import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Canvas } from '../src/components/Canvas';
import { applyPaletteDrop, createInitialBuilderSchema } from '../src/lib/layout-engine';

describe('Canvas preview mode', () => {
  it('shows breakpoint and data mode metadata for rendered components', () => {
    const baseSchema = createInitialBuilderSchema('preview-page');
    const firstColumnId = baseSchema.sections?.[0]?.rows[0]?.columns[0]?.id ?? '';
    const result = applyPaletteDrop(
      baseSchema,
      { kind: 'component', type: 'input.text', displayName: 'Text Input' },
      { kind: 'column', columnId: firstColumnId },
      null,
    );

    render(
      <Canvas
        schema={result.schema}
        editMode={false}
        previewBreakpoint="mobile"
        dataMode="real"
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        onDropPaletteItem={vi.fn()}
      />, 
    );

    expect(screen.getByText('MOBILE | LIVE DATA')).toBeInTheDocument();
  });
});
