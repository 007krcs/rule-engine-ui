import type { ComponentContract } from '@platform/component-contract';
import type { JSONValue, Rule, UISchema } from '@platform/schema';

export const PLATFORM_PLUGIN_API_VERSION = '1.0.0';

export interface PluginMeta {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  description?: string;
  author?: string;
  homepage?: string;
  capabilities?: string[];
}

export interface ComponentRegistration<TImplementation = unknown> {
  contract: ComponentContract;
  implementation?: TImplementation;
}

export interface ThemeRegistration {
  id: string;
  name: string;
  tokens: Record<string, JSONValue>;
  description?: string;
}

export interface DataSourceRegistration {
  id: string;
  name: string;
  description?: string;
  schema?: JSONValue;
}

export interface RendererContext<TComponentRegistry = unknown> {
  mount: HTMLElement;
  uiSchema?: UISchema;
  componentType?: string;
  props?: Record<string, JSONValue>;
  registry?: TComponentRegistry;
  locale?: string;
  theme?: ThemeRegistration;
  data?: JSONValue;
}

export interface RendererRegistration<TComponentRegistry = unknown> {
  id: string;
  name: string;
  framework: string;
  render: (context: RendererContext<TComponentRegistry>) => void;
  unmount?: (mount: HTMLElement) => void;
}

export interface PluginRegistry<
  TComponentImplementation = unknown,
  TRenderer extends RendererRegistration = RendererRegistration,
> {
  registerPluginMeta(meta: PluginMeta): void;
  registerComponent(component: ComponentContract | ComponentRegistration<TComponentImplementation>, implementation?: TComponentImplementation): void;
  registerRule(rule: Rule): void;
  registerTheme(theme: ThemeRegistration): void;
  registerRenderer(renderer: TRenderer): void;
  registerDataSource(dataSource: DataSourceRegistration): void;
  listPlugins(): PluginMeta[];
  listComponents(): ComponentRegistration<TComponentImplementation>[];
  listRules(): Rule[];
  listThemes(): ThemeRegistration[];
  listRenderers(): TRenderer[];
  listDataSources(): DataSourceRegistration[];
}

export interface RuntimePlugin<
  TComponentImplementation = unknown,
  TRenderer extends RendererRegistration = RendererRegistration,
> {
  meta: PluginMeta;
  setup(registry: PluginRegistry<TComponentImplementation, TRenderer>): void;
}

export interface DeclarativePlugin<
  TComponentImplementation = unknown,
  TRenderer extends RendererRegistration = RendererRegistration,
> {
  meta: PluginMeta;
  components?: ComponentRegistration<TComponentImplementation>[];
  rules?: Rule[];
  themes?: ThemeRegistration[];
  renderers?: TRenderer[];
  dataSources?: DataSourceRegistration[];
}

export interface LegacyRuntimePlugin<
  TComponentImplementation = unknown,
  TRenderer extends RendererRegistration = RendererRegistration,
> {
  id: string;
  setup(registry: PluginRegistry<TComponentImplementation, TRenderer>): void;
}

export type PlatformPlugin<
  TComponentImplementation = unknown,
  TRenderer extends RendererRegistration = RendererRegistration,
> =
  | RuntimePlugin<TComponentImplementation, TRenderer>
  | DeclarativePlugin<TComponentImplementation, TRenderer>
  | LegacyRuntimePlugin<TComponentImplementation, TRenderer>;

export function createPluginRegistry<
  TComponentImplementation = unknown,
  TRenderer extends RendererRegistration = RendererRegistration,
>(): PluginRegistry<TComponentImplementation, TRenderer> {
  const plugins: PluginMeta[] = [];
  const components: ComponentRegistration<TComponentImplementation>[] = [];
  const rules: Rule[] = [];
  const themes: ThemeRegistration[] = [];
  const renderers: TRenderer[] = [];
  const dataSources: DataSourceRegistration[] = [];

  return {
    registerPluginMeta(meta): void {
      if (!plugins.some((existing) => existing.id === meta.id)) {
        plugins.push({ ...meta });
      }
    },
    registerComponent(component, implementation): void {
      if ('contract' in component) {
        components.push({
          contract: component.contract,
          implementation: component.implementation,
        });
      } else {
        components.push({
          contract: component,
          implementation,
        });
      }
    },
    registerRule(rule): void {
      rules.push(rule);
    },
    registerTheme(theme): void {
      themes.push({ ...theme, tokens: { ...theme.tokens } });
    },
    registerRenderer(renderer): void {
      renderers.push(renderer);
    },
    registerDataSource(dataSource): void {
      dataSources.push({ ...dataSource });
    },
    listPlugins(): PluginMeta[] {
      return plugins.map((plugin) => ({ ...plugin }));
    },
    listComponents(): ComponentRegistration<TComponentImplementation>[] {
      return components.map((entry) => ({ ...entry, contract: { ...entry.contract } }));
    },
    listRules(): Rule[] {
      return rules.map((rule) => ({ ...rule }));
    },
    listThemes(): ThemeRegistration[] {
      return themes.map((theme) => ({ ...theme, tokens: { ...theme.tokens } }));
    },
    listRenderers(): TRenderer[] {
      return [...renderers];
    },
    listDataSources(): DataSourceRegistration[] {
      return dataSources.map((dataSource) => ({ ...dataSource }));
    },
  };
}

export function registerPlugin<
  TComponentImplementation = unknown,
  TRenderer extends RendererRegistration = RendererRegistration,
>(registry: PluginRegistry<TComponentImplementation, TRenderer>, plugin: PlatformPlugin<TComponentImplementation, TRenderer>): void {
  if ('meta' in plugin) {
    registry.registerPluginMeta(plugin.meta);
  } else {
    registry.registerPluginMeta({
      id: plugin.id,
      name: plugin.id,
      version: '0.0.0',
      apiVersion: PLATFORM_PLUGIN_API_VERSION,
    });
  }

  if ('setup' in plugin) {
    plugin.setup(registry);
    return;
  }

  if (plugin.components) {
    for (const component of plugin.components) {
      registry.registerComponent(component);
    }
  }

  if (plugin.rules) {
    for (const rule of plugin.rules) {
      registry.registerRule(rule);
    }
  }

  if (plugin.themes) {
    for (const theme of plugin.themes) {
      registry.registerTheme(theme);
    }
  }

  if (plugin.renderers) {
    for (const renderer of plugin.renderers) {
      registry.registerRenderer(renderer as TRenderer);
    }
  }

  if (plugin.dataSources) {
    for (const dataSource of plugin.dataSources) {
      registry.registerDataSource(dataSource);
    }
  }
}

export function registerPlugins<
  TComponentImplementation = unknown,
  TRenderer extends RendererRegistration = RendererRegistration,
>(registry: PluginRegistry<TComponentImplementation, TRenderer>, plugins: Array<PlatformPlugin<TComponentImplementation, TRenderer>>): void {
  for (const plugin of plugins) {
    registerPlugin(registry, plugin);
  }
}

export function isPluginCompatible(apiVersion: string, expected = PLATFORM_PLUGIN_API_VERSION): boolean {
  const expectedMajor = expected.split('.')[0] ?? expected;
  const actualMajor = apiVersion.split('.')[0] ?? apiVersion;
  return expectedMajor === actualMajor;
}
