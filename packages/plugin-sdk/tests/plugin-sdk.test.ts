import { describe, expect, it } from 'vitest';
import { createPluginRegistry, registerPlugin, type DeclarativePlugin } from '../src/index';

describe('plugin-sdk', () => {
  it('registers components and rules from plugins', () => {
    const registry = createPluginRegistry();
    const samplePlugin: DeclarativePlugin = {
      meta: {
        id: 'sample-plugin',
        name: 'Sample Plugin',
        version: '0.1.0',
        apiVersion: '1.0.0',
      },
      components: [
        {
          contract: {
            type: 'action.button',
            displayName: 'Action Button',
            category: 'Action',
            props: {},
            bindings: [],
            events: [{ name: 'click' }],
          },
        },
      ],
      rules: [
        {
          ruleId: 'R1',
          priority: 1,
          when: { op: 'eq', left: { value: true }, right: { value: true } },
          actions: [{ type: 'setField', path: 'data.ready', value: true }],
        },
      ],
      themes: [
        {
          id: 'sample-theme',
          name: 'Sample Theme',
          tokens: { 'color.primary': '#3366ff' },
        },
      ],
      renderers: [
        {
          id: 'renderer.react',
          name: 'React Renderer',
          framework: 'react',
          render: () => {
            // placeholder
          },
        },
      ],
    };

    registerPlugin(registry, samplePlugin);

    expect(registry.listComponents()).toHaveLength(1);
    expect(registry.listRules()).toHaveLength(1);
    expect(registry.listThemes()).toHaveLength(1);
    expect(registry.listRenderers()).toHaveLength(1);
  });
});
