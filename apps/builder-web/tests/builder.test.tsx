import { describe, expect, it } from 'vitest';
import type { UIComponent } from '@platform/schema';
import { addComponent, buildSchema, createBuilderState, removeComponent } from '../src/index';

describe('builder-web', () => {
  it('builds schema from components', () => {
    const state = createBuilderState({ components: [] });
    const component: UIComponent = {
      id: 'field',
      type: 'input',
      adapterHint: 'material.input',
      accessibility: {
        ariaLabelKey: 'runtime.filters.customerName.aria',
        keyboardNav: true,
        focusOrder: 1,
      },
    };
    const next = addComponent(state, component);
    const schema = buildSchema(next);
    expect(schema.components).toHaveLength(1);
    expect(schema.layout.componentIds).toContain('field');
  });

  it('removes components', () => {
    const state = createBuilderState();
    const next = removeComponent(state, 'customerName');
    expect(next.components.length).toBe(0);
  });
});
