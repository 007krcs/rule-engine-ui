import { describe, expect, it } from 'vitest';
import { createPluginRegistry, registerPlugin } from '../src/index';

describe('plugin-sdk', () => {
  it('registers components and rules from plugins', () => {
    const registry = createPluginRegistry();

    registerPlugin(registry, {
      id: 'sample-plugin',
      setup(target) {
        target.registerComponent({
          type: 'action.button',
          displayName: 'Action Button',
          category: 'Action',
          props: {},
          bindings: [],
          events: [{ name: 'click' }],
        });

        target.registerRule({
          ruleId: 'R1',
          priority: 1,
          when: { op: 'eq', left: { value: true }, right: { value: true } },
          actions: [{ type: 'setField', path: 'data.ready', value: true }],
        });
      },
    });

    expect(registry.listComponents()).toHaveLength(1);
    expect(registry.listRules()).toHaveLength(1);
  });
});
