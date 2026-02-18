'use client';

import {
  adapterPrefixFromHint,
  adapterPrefixesForIds,
  externalAdapterPrefixesForIds,
  listRuntimeAdapterDefinitions,
  registerRuntimeAdapterDefinition as registerRuntimeAdapterDefinitionInternal,
  resolveRuntimeAdapterIds,
  type RuntimeAdapterDefinition,
} from '@/lib/runtime-adapter-definitions';

export type RuntimeAdapterRegistrationResult = {
  ok: boolean;
  packId: string;
  error?: string;
};

export function registerRuntimeAdapterDefinition(
  definition: RuntimeAdapterDefinition,
): void {
  registerRuntimeAdapterDefinitionInternal(definition);
}

export async function registerRuntimeAdapters(
  adapterIds: readonly string[],
): Promise<RuntimeAdapterRegistrationResult[]> {
  const { loadRuntimeAdapterPacks, registerRuntimeAdapterPackDefinition } =
    await import('@platform/adapter-registry');

  for (const definition of listRuntimeAdapterDefinitions()) {
    registerRuntimeAdapterPackDefinition({
      id: definition.id,
      prefix: definition.prefix,
      defaultEnabled: definition.defaultEnabled,
      external: definition.external,
    });
  }

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
  listRuntimeAdapterDefinitions,
  resolveRuntimeAdapterIds,
};
