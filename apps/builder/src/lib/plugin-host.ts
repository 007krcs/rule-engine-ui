import type { ComponentType } from 'react';
import { createDefaultComponentRegistry, getDefaultComponentCatalog } from '@platform/component-system';
import {
  createPluginRegistry,
  type ComponentPluginInterface,
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
let dynamicPluginsLoaded = false;

type BuilderPluginModule =
  | PlatformPlugin<BuilderComponentImplementation, BuilderRendererRegistration>
  | Array<PlatformPlugin<BuilderComponentImplementation, BuilderRendererRegistration>>;

const dynamicPluginLoaders: Record<string, () => Promise<BuilderPluginModule>> = {
  'external.weather': async () => {
    const module = await import('../plugins/external-weather-plugin');
    return module.externalWeatherPlugin as PlatformPlugin<
      BuilderComponentImplementation,
      BuilderRendererRegistration
    >;
  },
};

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

export async function loadBuilderPlugins(): Promise<void> {
  if (dynamicPluginsLoaded) return;
  dynamicPluginsLoaded = true;

  const requested = resolveDynamicPluginIds();
  if (requested.length === 0) return;

  const loadedPlugins: Array<PlatformPlugin<BuilderComponentImplementation, BuilderRendererRegistration>> = [];
  for (const id of requested) {
    const loader = dynamicPluginLoaders[id];
    if (!loader) continue;
    const module = await loader();
    if (Array.isArray(module)) {
      loadedPlugins.push(...module);
    } else {
      loadedPlugins.push(module);
    }
  }

  if (loadedPlugins.length > 0) {
    registerPlugins(
      pluginRegistry,
      loadedPlugins as Array<PlatformPlugin<BuilderComponentImplementation, BuilderRendererRegistration>>,
    );
  }
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

function resolveDynamicPluginIds(): string[] {
  const ids = new Set<string>();
  const fromEnv = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_BUILDER_PLUGINS : undefined;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    fromEnv
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => ids.add(entry));
  }

  const fromGlobal = (
    globalThis as { __RULEFLOW_BUILDER_PLUGINS__?: string[] | ComponentPluginInterface[] }
  ).__RULEFLOW_BUILDER_PLUGINS__;
  if (Array.isArray(fromGlobal)) {
    fromGlobal.forEach((entry) => {
      if (typeof entry === 'string' && entry.trim()) {
        ids.add(entry.trim());
      } else if (isComponentPluginInterface(entry)) {
        pluginRegistry.registerComponent(entry);
      }
    });
  }

  return Array.from(ids.values());
}

function isComponentPluginInterface(value: unknown): value is ComponentPluginInterface {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.type === 'string' && typeof record.renderer === 'function' && typeof record.contract === 'object';
}
