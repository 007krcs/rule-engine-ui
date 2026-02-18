import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadRuntimeAdapterPacks: vi.fn(),
  registerRuntimeAdapterPackDefinition: vi.fn(),
}));

vi.mock('@platform/adapter-registry', () => ({
  listRuntimeAdapterPackDefinitions: () => [
    { id: 'platform', prefix: 'platform.', defaultEnabled: true, external: false },
    { id: 'material', prefix: 'material.', defaultEnabled: false, external: true },
    { id: 'aggrid', prefix: 'aggrid.', defaultEnabled: true, external: true },
  ],
  loadRuntimeAdapterPacks: mocks.loadRuntimeAdapterPacks,
  registerRuntimeAdapterPackDefinition: mocks.registerRuntimeAdapterPackDefinition,
  adapterPrefixFromHint: (adapterHint: string) => {
    const prefix = adapterHint.split('.')[0]?.trim();
    return prefix ? `${prefix}.` : '';
  },
  adapterPrefixesForIds: (adapterIds: readonly string[]) =>
    adapterIds.map((id) => `${id}.`),
  externalAdapterPrefixesForIds: (adapterIds: readonly string[]) =>
    adapterIds.filter((id) => id !== 'platform').map((id) => `${id}.`),
}));

import {
  registerRuntimeAdapters,
  resolveRuntimeAdapterIds,
} from '@/lib/runtime-adapters';

describe('runtime adapter loading', () => {
  beforeEach(() => {
    mocks.loadRuntimeAdapterPacks.mockReset();
    mocks.registerRuntimeAdapterPackDefinition.mockReset();
  });

  it('keeps material disabled unless explicitly enabled via runtime flags', () => {
    expect(resolveRuntimeAdapterIds({})).toEqual(['platform', 'aggrid']);

    expect(resolveRuntimeAdapterIds({ 'adapter.material': true })).toEqual([
      'platform',
      'material',
      'aggrid',
    ]);
  });

  it('registers enabled packs and reports load success', async () => {
    mocks.loadRuntimeAdapterPacks.mockResolvedValue([
      { ok: true, packId: 'platform' },
      { ok: true, packId: 'material' },
    ]);

    const results = await registerRuntimeAdapters(['platform', 'material']);

    expect(mocks.loadRuntimeAdapterPacks).toHaveBeenCalledWith(['platform', 'material']);
    expect(results).toEqual([
      { ok: true, packId: 'platform' },
      { ok: true, packId: 'material' },
    ]);
  });
});
