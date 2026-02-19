import { describe, expect, it } from 'vitest';
import { applyPaletteDrop, createInitialBuilderSchema, getLayoutNode, updateLayoutNodeProperties } from '../src/lib/layout-engine';

describe('layout engine', () => {
  it('adds sections and rows through palette drops', () => {
    const baseSchema = createInitialBuilderSchema('test-page');

    const sectionDrop = applyPaletteDrop(
      baseSchema,
      { kind: 'section', type: 'layout.section', displayName: 'New Section' },
      { kind: 'canvas' },
      null,
    );

    expect(sectionDrop.changed).toBe(true);
    expect(sectionDrop.schema.sections).toHaveLength(2);

    const targetSectionId = sectionDrop.schema.sections?.[0]?.id;
    expect(targetSectionId).toBeTruthy();

    const rowDrop = applyPaletteDrop(
      sectionDrop.schema,
      { kind: 'row', type: 'layout.row', displayName: 'Row' },
      { kind: 'section', sectionId: targetSectionId ?? '' },
      targetSectionId ?? null,
    );

    expect(rowDrop.changed).toBe(true);
    expect(rowDrop.schema.sections?.[0]?.rows.length).toBeGreaterThan(1);
  });

  it('drops components into a column and appends component schema', () => {
    const baseSchema = createInitialBuilderSchema('test-page');
    const firstColumnId = baseSchema.sections?.[0]?.rows[0]?.columns[0]?.id;
    expect(firstColumnId).toBeTruthy();

    const result = applyPaletteDrop(
      baseSchema,
      { kind: 'component', type: 'input.text', displayName: 'Text Input' },
      { kind: 'column', columnId: firstColumnId ?? '' },
      null,
    );

    expect(result.changed).toBe(true);
    expect(result.schema.components).toHaveLength(1);
    expect(result.schema.components[0]?.type).toBe('input.text');

    const columnNode = getLayoutNode(result.schema, firstColumnId ?? '');
    expect(columnNode?.kind).toBe('column');
    if (columnNode?.kind === 'column') {
      expect(columnNode.children).toHaveLength(1);
      expect(columnNode.children[0]?.kind).toBe('component');
    }
  });

  it('updates selected node properties with clamped spans', () => {
    const baseSchema = createInitialBuilderSchema('test-page');
    const sectionId = baseSchema.sections?.[0]?.id;
    const columnId = baseSchema.sections?.[0]?.rows[0]?.columns[0]?.id;
    expect(sectionId).toBeTruthy();
    expect(columnId).toBeTruthy();

    const withSectionTitle = updateLayoutNodeProperties(baseSchema, sectionId ?? '', {
      title: 'Customer Details',
      className: 'customer-section',
    });
    const withColumnSpan = updateLayoutNodeProperties(withSectionTitle, columnId ?? '', {
      span: 99,
    });

    const updatedSection = getLayoutNode(withColumnSpan, sectionId ?? '');
    const updatedColumn = getLayoutNode(withColumnSpan, columnId ?? '');

    expect(updatedSection?.kind).toBe('section');
    if (updatedSection?.kind === 'section') {
      expect(updatedSection.title).toBe('Customer Details');
      expect(updatedSection.className).toBe('customer-section');
    }

    expect(updatedColumn?.kind).toBe('column');
    if (updatedColumn?.kind === 'column') {
      expect(updatedColumn.span).toBe(12);
    }
  });
});
