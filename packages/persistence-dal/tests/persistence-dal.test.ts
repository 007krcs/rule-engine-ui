import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { registerBusinessMetricHook } from '@platform/observability';
import { DemoFileDalAdapter } from '../src/adapters/DemoFileDalAdapter';
import { InMemoryDalAdapter } from '../src/adapters/InMemoryDalAdapter';

describe('persistence-dal', () => {
  it('enforces lifecycle transitions', async () => {
    const dal = new InMemoryDalAdapter();
    const ctx = { tenantId: 'tenant-a' };
    const saved = await dal.saveConfig(ctx, {
      configId: 'orders',
      name: 'Orders',
      bundle: { ok: true },
    });
    const versionId = saved.versions[0]!.versionId;
    await expect(
      dal.transitionVersion(ctx, {
        configId: 'orders',
        versionId,
        toStatus: 'Approved',
      }),
    ).rejects.toThrow(/Invalid lifecycle transition/);
  });

  it('isolates tenants', async () => {
    const dal = new InMemoryDalAdapter();
    await dal.saveConfig(
      { tenantId: 'tenant-a' },
      { configId: 'orders', name: 'Orders', bundle: { tenant: 'a' } },
    );
    const missing = await dal.getConfig({ tenantId: 'tenant-b' }, 'orders');
    expect(missing).toBeNull();
  });

  it('uses file locking for concurrent writes', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'dal-lock-'));
    const dal = new DemoFileDalAdapter(baseDir);
    const ctx = { tenantId: 'tenant-a' };

    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        dal.saveConfig(ctx, {
          configId: 'orders',
          name: 'Orders',
          versionLabel: `1.0.${i}`,
          bundle: { index: i },
        }),
      ),
    );

    const versions = await dal.listVersions(ctx, 'orders');
    expect(versions.length).toBe(20);
  });

  it('emits external-call metrics for demo file adapter operations', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'dal-metrics-'));
    const dal = new DemoFileDalAdapter(baseDir);
    const metrics: string[] = [];
    const detach = registerBusinessMetricHook((metric) => {
      metrics.push(metric.name);
    });
    try {
      await dal.saveConfig(
        { tenantId: 'tenant-a' },
        { configId: 'orders', name: 'Orders', bundle: { ok: true } },
      );
      expect(metrics).toContain('external_call_duration_ms');
    } finally {
      detach();
    }
  });
});
