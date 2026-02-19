import { describe, expect, it } from 'vitest';
import {
  appendChildToColumn,
  createLayoutComponentNode,
  createSectionNode,
  createUISchema,
  findLayoutNodeById,
} from '../src/index';

describe('layout tree helpers', () => {
  it('creates a default section with row and columns', () => {
    const section = createSectionNode({ title: 'Main' });
    expect(section.kind).toBe('section');
    expect(section.rows).toHaveLength(1);
    expect(section.rows[0]?.columns.length).toBeGreaterThan(0);
  });

  it('builds a schema with sections', () => {
    const schema = createUISchema({
      pageId: 'page-1',
      sections: [createSectionNode({ title: 'Overview' })],
      components: [],
    });

    expect(schema.pageId).toBe('page-1');
    expect(schema.sections).toHaveLength(1);
  });

  it('adds nested children and supports recursive lookup', () => {
    const section = createSectionNode({ title: 'Primary' });
    const columnId = section.rows[0]?.columns[0]?.id;
    expect(columnId).toBeTruthy();

    const nestedSection = createSectionNode({ title: 'Nested' });
    const sections = appendChildToColumn([section], columnId ?? '', nestedSection);
    const nestedNode = findLayoutNodeById(sections, nestedSection.id);
    expect(nestedNode?.kind).toBe('section');

    const componentNode = createLayoutComponentNode('component-1', { componentType: 'input.text' });
    const withComponent = appendChildToColumn(sections, columnId ?? '', componentNode);
    const foundComponent = findLayoutNodeById(withComponent, componentNode.id);
    expect(foundComponent?.kind).toBe('component');
  });
});
