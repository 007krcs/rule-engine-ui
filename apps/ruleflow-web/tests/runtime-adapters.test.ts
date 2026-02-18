import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadRuntimeAdapterPacks: vi.fn(),
  registerRuntimeAdapterPackDefinition: vi.fn(),
}));

vi.mock('@platform/adapter-registry', () => ({
  loadRuntimeAdapterPacks: mocks.loadRuntimeAdapterPacks,
  registerRuntimeAdapterPackDefinition: mocks.registerRuntimeAdapterPackDefinition,
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
    expect(resolveRuntimeAdapterIds({})).toEqual([
      'platform',
      'aggrid',
      'highcharts',
      'd3',
      'company',
    ]);

    expect(resolveRuntimeAdapterIds({ 'adapter.material': true })).toEqual([
      'platform',
      'material',
      'aggrid',
      'highcharts',
      'd3',
      'company',
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
