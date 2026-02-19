import type { ComponentContract } from '@platform/component-contract';
import type { Rule } from '@platform/schema';

export interface RuntimePlugin {
  id: string;
  setup(registry: PluginRegistry): void;
}

export interface PluginRegistry {
  registerComponent(component: ComponentContract): void;
  registerRule(rule: Rule): void;
  listComponents(): ComponentContract[];
  listRules(): Rule[];
}

export function createPluginRegistry(): PluginRegistry {
  const components: ComponentContract[] = [];
  const rules: Rule[] = [];

  return {
    registerComponent(component): void {
      components.push(component);
    },
    registerRule(rule): void {
      rules.push(rule);
    },
    listComponents(): ComponentContract[] {
      return components.map((component) => ({ ...component }));
    },
    listRules(): Rule[] {
      return rules.map((rule) => ({ ...rule }));
    },
  };
}

export function registerPlugin(registry: PluginRegistry, plugin: RuntimePlugin): void {
  plugin.setup(registry);
}
