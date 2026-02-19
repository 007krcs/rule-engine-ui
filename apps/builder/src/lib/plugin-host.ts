import type { ComponentType } from 'react';
import { createDefaultComponentRegistry, getDefaultComponentCatalog } from '@platform/component-system';
import {
  createPluginRegistry,
  registerPlugins,
  type PlatformPlugin,
  type RendererRegistration,
} from '@platform/plugin-sdk';
import type { ComponentContract } from '@platform/component-contract';
import { builderPlugins } from '../plugins';

export type BuilderComponentImplementation = ComponentType<any>;
export type BuilderRendererRegistration = RendererRegistration;

const pluginRegistry = createPluginRegistry<BuilderComponentImplementation, BuilderRendererRegistration>();
registerPlugins(pluginRegistry, builderPlugins as Array<PlatformPlugin<BuilderComponentImplementation, BuilderRendererRegistration>>);

export function getBuilderComponentCatalog(): ComponentContract[] {
  const core = getDefaultComponentCatalog();
  const pluginContracts = pluginRegistry.listComponents().map((entry) => entry.contract);
  return mergeComponentContracts(core, pluginContracts);
}

export function getBuilderComponentRegistry() {
  const registry = createDefaultComponentRegistry();
  for (const entry of pluginRegistry.listComponents()) {
    registry.register(entry.contract, entry.implementation);
  }
  return registry;
}

export function getBuilderRenderers(): BuilderRendererRegistration[] {
  return pluginRegistry.listRenderers();
}

export function getBuilderPlugins() {
  return pluginRegistry.listPlugins();
}

function mergeComponentContracts(base: ComponentContract[], additions: ComponentContract[]): ComponentContract[] {
  const map = new Map<string, ComponentContract>();
  for (const contract of base) {
    map.set(contract.type, contract);
  }
  for (const contract of additions) {
    map.set(contract.type, contract);
  }
  return Array.from(map.values());
}
