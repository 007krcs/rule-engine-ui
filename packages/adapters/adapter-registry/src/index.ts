import {
  getDefaultAdapterRegistry,
  registerAdapter as registerRendererAdapter,
  type AdapterRegistry,
  type AdapterRenderFn,
} from '@platform/react-renderer';
import { registerPlatformAdapter } from '@platform/react-platform-adapter';
import { registerAgGridAdapter } from '@platform/react-aggrid-adapter';
import { registerHighchartsAdapter } from '@platform/react-highcharts-adapter';
import { registerD3Adapter } from '@platform/react-d3-adapter';
import { registerCompanyAdapter } from '@platform/react-company-adapter';

export type RuntimeAdapterPackId =
  | 'platform'
  | 'material'
  | 'aggrid'
  | 'highcharts'
  | 'd3'
  | 'company'
  | (string & {});

export interface RuntimeAdapterPackDefinition {
  id: RuntimeAdapterPackId;
  prefix: string;
  defaultEnabled: boolean;
  external: boolean;
}

export type RuntimeAdapterPackLoader = (input: {
  adapterRegistry: AdapterRegistry;
}) => Promise<void> | void;

export type AdapterComponentRegistry = Record<string, unknown>;

export interface LoadAdapterPackResult {
  ok: boolean;
  packId: string;
  error?: string;
}

const defaultDefinitions: RuntimeAdapterPackDefinition[] = [
  { id: 'platform', prefix: 'platform.', defaultEnabled: true, external: false },
  { id: 'material', prefix: 'material.', defaultEnabled: false, external: true },
  { id: 'aggrid', prefix: 'aggrid.', defaultEnabled: true, external: true },
  { id: 'highcharts', prefix: 'highcharts.', defaultEnabled: true, external: true },
  { id: 'd3', prefix: 'd3.', defaultEnabled: true, external: true },
  { id: 'company', prefix: 'company.', defaultEnabled: true, external: true },
];

const definitions = [...defaultDefinitions];

const componentRegistries = new Map<string, AdapterComponentRegistry>();
const loaders = new Map<string, RuntimeAdapterPackLoader>();
const loading = new Map<string, Promise<LoadAdapterPackResult>>();
const loaded = new Set<string>();

export const defaultRuntimeAdapterRegistry = getDefaultAdapterRegistry();

registerDefaultLoaders();

export function registerAdapter(
  prefix: string,
  impl: AdapterRenderFn,
  adapterRegistry: AdapterRegistry = defaultRuntimeAdapterRegistry,
): void {
  registerRendererAdapter(prefix, impl, adapterRegistry);
}

export function registerComponentRegistry(
  prefix: string,
  components: AdapterComponentRegistry,
): void {
  const normalized = normalizePrefix(prefix);
  componentRegistries.set(normalized, { ...components });
}

export function getRegisteredComponentRegistry(
  prefix: string,
): AdapterComponentRegistry | null {
  const normalized = normalizePrefix(prefix);
  const value = componentRegistries.get(normalized);
  return value ? { ...value } : null;
}

export function listComponentRegistries(): Array<{
  prefix: string;
  components: AdapterComponentRegistry;
}> {
  return [...componentRegistries.entries()].map(([prefix, components]) => ({
    prefix,
    components: { ...components },
  }));
}

export function registerRuntimeAdapterPackDefinition(
  definition: RuntimeAdapterPackDefinition,
): void {
  const normalized: RuntimeAdapterPackDefinition = {
    ...definition,
    id: definition.id.trim(),
    prefix: normalizePrefix(definition.prefix),
  };
  if (!normalized.id) {
    throw new Error('Adapter pack id must be a non-empty string.');
  }

  const existingIndex = definitions.findIndex(
    (item) => item.id === normalized.id || item.prefix === normalized.prefix,
  );
  if (existingIndex >= 0) {
    definitions[existingIndex] = normalized;
    return;
  }
  definitions.push(normalized);
}

export function listRuntimeAdapterPackDefinitions(): RuntimeAdapterPackDefinition[] {
  return definitions.map((definition) => ({ ...definition }));
}

export function resolveRuntimeAdapterPackIds(
  featureFlags: Record<string, boolean>,
): string[] {
  return definitions
    .filter((definition) => {
      const flagKey = `adapter.${definition.id}`;
      const explicit = featureFlags[flagKey];
      return typeof explicit === 'boolean' ? explicit : definition.defaultEnabled;
    })
    .map((definition) => definition.id);
}

export function adapterPrefixesForIds(adapterIds: readonly string[]): string[] {
  const active = new Set(adapterIds);
  return definitions
    .filter((definition) => active.has(definition.id))
    .map((definition) => definition.prefix);
}

export function externalAdapterPrefixesForIds(adapterIds: readonly string[]): string[] {
  const active = new Set(adapterIds);
  return definitions
    .filter((definition) => definition.external && active.has(definition.id))
    .map((definition) => definition.prefix);
}

export function adapterPrefixFromHint(adapterHint: string): string {
  const prefix = adapterHint.split('.')[0]?.trim();
  return prefix ? `${prefix}.` : '';
}

export function registerAdapterPackLoader(
  packId: RuntimeAdapterPackId | (string & {}),
  loader: RuntimeAdapterPackLoader,
): void {
  const normalized = packId.trim();
  if (!normalized) {
    throw new Error('Adapter pack id must be a non-empty string.');
  }
  loaders.set(normalized, loader);
  loaded.delete(normalized);
}

export function isAdapterPackLoaded(packId: string): boolean {
  return loaded.has(packId.trim());
}

export function listLoadedAdapterPacks(): string[] {
  return [...loaded.values()];
}

export async function loadAdapterPack(
  packId: string,
  input: { adapterRegistry?: AdapterRegistry } = {},
): Promise<LoadAdapterPackResult> {
  const normalized = packId.trim();
  if (!normalized) {
    return { ok: false, packId, error: 'Adapter pack id must be a non-empty string.' };
  }
  if (loaded.has(normalized)) {
    return { ok: true, packId: normalized };
  }

  const loader = loaders.get(normalized);
  if (!loader) {
    return {
      ok: false,
      packId: normalized,
      error: `No adapter pack loader registered for "${normalized}".`,
    };
  }

  const inflight = loading.get(normalized);
  if (inflight) {
    return await inflight;
  }

  const pending = (async (): Promise<LoadAdapterPackResult> => {
    try {
      await loader({
        adapterRegistry: input.adapterRegistry ?? defaultRuntimeAdapterRegistry,
      });
      loaded.add(normalized);
      return { ok: true, packId: normalized };
    } catch (error) {
      return {
        ok: false,
        packId: normalized,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      loading.delete(normalized);
    }
  })();

  loading.set(normalized, pending);
  return await pending;
}

export async function loadRuntimeAdapterPacks(
  packIds: readonly string[],
  input: { adapterRegistry?: AdapterRegistry } = {},
): Promise<LoadAdapterPackResult[]> {
  const uniquePackIds = [...new Set(packIds.map((id) => id.trim()).filter(Boolean))];
  return await Promise.all(
    uniquePackIds.map((packId) => loadAdapterPack(packId, input)),
  );
}

export async function bootstrapRuntimeAdapters(
  enabledPackIds: readonly string[],
  input: { adapterRegistry?: AdapterRegistry } = {},
): Promise<LoadAdapterPackResult[]> {
  const baseline = new Set<string>(['platform', 'aggrid']);
  for (const packId of enabledPackIds) baseline.add(packId);
  return await loadRuntimeAdapterPacks([...baseline], input);
}

export function resetAdapterRegistryStateForTests(): void {
  componentRegistries.clear();
  loading.clear();
  loaded.clear();
  loaders.clear();
  definitions.splice(0, definitions.length, ...defaultDefinitions);
  registerDefaultLoaders();
}

function registerDefaultLoaders(): void {
  registerAdapterPackLoader('platform', () => {
    registerPlatformAdapter();
  });
  registerAdapterPackLoader('aggrid', () => {
    registerAgGridAdapter();
  });
  registerAdapterPackLoader('highcharts', () => {
    registerHighchartsAdapter();
  });
  registerAdapterPackLoader('d3', () => {
    registerD3Adapter();
  });
  registerAdapterPackLoader('company', () => {
    registerCompanyAdapter();
  });
  registerAdapterPackLoader('material', async ({ adapterRegistry }) => {
    const moduleId = '@platform/react-material-adapter';
    const material = await import(moduleId);
    const registerMaterial = (
      material as {
        registerMaterialAdapters?: (targetRegistry?: AdapterRegistry) => void;
      }
    ).registerMaterialAdapters;
    if (typeof registerMaterial !== 'function') {
      throw new Error('Material adapter pack does not export registerMaterialAdapters.');
    }
    registerMaterial(adapterRegistry);
  });
}

function normalizePrefix(value: string): string {
  const normalized = value.trim();
  if (!normalized || !normalized.endsWith('.')) {
    throw new Error('Adapter prefix must be a non-empty string ending with "."');
  }
  return normalized;
}
