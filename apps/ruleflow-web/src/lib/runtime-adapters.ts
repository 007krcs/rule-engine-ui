import {
  adapterPrefixFromHint,
  adapterPrefixesForIds,
  externalAdapterPrefixesForIds,
  listRuntimeAdapterPackDefinitions,
  loadRuntimeAdapterPacks,
  registerRuntimeAdapterPackDefinition,
  type RuntimeAdapterPackDefinition,
  type LoadAdapterPackResult,
} from '@platform/adapter-registry';

export type RuntimeAdapterId =
  | 'platform'
  | 'material'
  | 'aggrid'
  | 'highcharts'
  | 'd3'
  | 'company';

export type RuntimeAdapterDefinition = RuntimeAdapterPackDefinition;

export type RuntimeAdapterRegistrationResult = LoadAdapterPackResult;

export function registerRuntimeAdapterDefinition(
  definition: RuntimeAdapterDefinition,
): void {
  registerRuntimeAdapterPackDefinition(definition);
}

export function listRuntimeAdapterDefinitions(): RuntimeAdapterDefinition[] {
  return listRuntimeAdapterPackDefinitions();
}

export function resolveRuntimeAdapterIds(
  featureFlags: Record<string, boolean>,
): string[] {
  return listRuntimeAdapterPackDefinitions()
    .filter((definition) => {
      const flagKey = `adapter.${definition.id}`;
      const explicit = featureFlags[flagKey];
      return typeof explicit === 'boolean' ? explicit : definition.defaultEnabled;
    })
    .map((definition) => definition.id);
}

export async function registerRuntimeAdapters(
  adapterIds: readonly string[],
): Promise<RuntimeAdapterRegistrationResult[]> {
  const results = await loadRuntimeAdapterPacks(adapterIds);
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0 && process.env.NODE_ENV !== 'production') {
    for (const result of failed) {
      // eslint-disable-next-line no-console
      console.warn(
        `[runtime-adapters] Failed to load adapter pack "${result.packId}": ${result.error ?? 'Unknown error'}`,
      );
    }
  }
  return results;
}

export async function registerRuntimeAdaptersFromFlags(
  featureFlags: Record<string, boolean>,
): Promise<string[]> {
  const adapterIds = resolveRuntimeAdapterIds(featureFlags);
  await registerRuntimeAdapters(adapterIds);
  return adapterIds;
}

export {
  adapterPrefixFromHint,
  adapterPrefixesForIds,
  externalAdapterPrefixesForIds,
};
