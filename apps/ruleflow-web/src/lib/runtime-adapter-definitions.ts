export type RuntimeAdapterId =
  | 'platform'
  | 'material'
  | 'aggrid'
  | 'highcharts'
  | 'd3'
  | 'company';

export type RuntimeAdapterDefinition = {
  id: RuntimeAdapterId | (string & {});
  prefix: string;
  defaultEnabled: boolean;
  external: boolean;
};

const runtimeAdapterDefinitions: RuntimeAdapterDefinition[] = [
  { id: 'platform', prefix: 'platform.', defaultEnabled: true, external: false },
  { id: 'material', prefix: 'material.', defaultEnabled: false, external: true },
  { id: 'aggrid', prefix: 'aggrid.', defaultEnabled: true, external: true },
  { id: 'highcharts', prefix: 'highcharts.', defaultEnabled: true, external: true },
  { id: 'd3', prefix: 'd3.', defaultEnabled: true, external: true },
  { id: 'company', prefix: 'company.', defaultEnabled: true, external: true },
];

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed) {
    throw new Error('Adapter prefix must be a non-empty string.');
  }
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

export function registerRuntimeAdapterDefinition(
  definition: RuntimeAdapterDefinition,
): void {
  const normalized: RuntimeAdapterDefinition = {
    ...definition,
    id: definition.id.trim(),
    prefix: normalizePrefix(definition.prefix),
  };
  const index = runtimeAdapterDefinitions.findIndex(
    (entry) => entry.id === normalized.id || entry.prefix === normalized.prefix,
  );
  if (index >= 0) {
    runtimeAdapterDefinitions[index] = normalized;
    return;
  }
  runtimeAdapterDefinitions.push(normalized);
}

export function listRuntimeAdapterDefinitions(): RuntimeAdapterDefinition[] {
  return runtimeAdapterDefinitions.map((definition) => ({ ...definition }));
}

export function resolveRuntimeAdapterIds(
  featureFlags: Record<string, boolean>,
): string[] {
  return runtimeAdapterDefinitions
    .filter((definition) => {
      const flagKey = `adapter.${definition.id}`;
      const explicit = featureFlags[flagKey];
      return typeof explicit === 'boolean' ? explicit : definition.defaultEnabled;
    })
    .map((definition) => definition.id);
}

export function adapterPrefixFromHint(adapterHint: string): string {
  const prefix = adapterHint.split('.')[0]?.trim();
  return prefix ? `${prefix}.` : '';
}

export function adapterPrefixesForIds(adapterIds: readonly string[]): string[] {
  const enabled = new Set(adapterIds);
  return runtimeAdapterDefinitions
    .filter((definition) => enabled.has(definition.id))
    .map((definition) => definition.prefix);
}

export function externalAdapterPrefixesForIds(
  adapterIds: readonly string[],
): string[] {
  const enabled = new Set(adapterIds);
  return runtimeAdapterDefinitions
    .filter((definition) => definition.external && enabled.has(definition.id))
    .map((definition) => definition.prefix);
}

