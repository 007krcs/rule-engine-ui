import { describe, expect, it } from 'vitest';
import { isFeatureFlagEnabled, toFeatureFlagMap } from '../src/server/runtime-controls';

describe('runtime controls rollout resolver', () => {
  it('supports deterministic percentage rollouts', () => {
    const enabled = isFeatureFlagEnabled(
      {
        key: 'adapter.material',
        enabled: true,
        value: { rolloutPercentage: 100 },
      },
      { tenantId: 'tenant-a' },
    );
    const disabled = isFeatureFlagEnabled(
      {
        key: 'adapter.material',
        enabled: true,
        value: { rolloutPercentage: 0 },
      },
      { tenantId: 'tenant-a' },
    );
    expect(enabled).toBe(true);
    expect(disabled).toBe(false);
  });

  it('supports tenant allow/deny lists and phased windows', () => {
    const now = new Date('2026-03-01T00:00:00.000Z');
    expect(
      isFeatureFlagEnabled(
        {
          key: 'builder.palette.externalAdapters',
          enabled: true,
          value: {
            tenantAllowlist: ['tenant-allow'],
            tenantDenylist: ['tenant-block'],
            phases: [{ name: 'phase-1', startAt: '2026-02-01T00:00:00.000Z', endAt: '2026-04-01T00:00:00.000Z', rolloutPercentage: 100 }],
          },
        },
        { tenantId: 'tenant-allow', now },
      ),
    ).toBe(true);

    expect(
      isFeatureFlagEnabled(
        {
          key: 'builder.palette.externalAdapters',
          enabled: true,
          value: { tenantAllowlist: ['tenant-allow'] },
        },
        { tenantId: 'tenant-other', now },
      ),
    ).toBe(false);
  });

  it('builds a boolean map with rollout logic applied', () => {
    const map = toFeatureFlagMap(
      [
        { key: 'a', enabled: true, value: { rolloutPercentage: 100 } },
        { key: 'b', enabled: true, value: { rolloutPercentage: 0 } },
      ],
      { tenantId: 'tenant-a' },
    );
    expect(map).toEqual({ a: true, b: false });
  });
});
