import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { FileConfigStore, TmpConfigStore } from '../src/store';

describe('ConfigStore', () => {
  it('creates and fetches config', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'core-runtime-store-create-'));
    const store = new FileConfigStore({ baseDir });

    await store.createConfig({
      id: 'orders',
      schema: { uiSchema: { version: '1.0.0' } },
    });

    const config = await store.getConfig('orders');
    expect(config?.id).toBe('orders');
    expect((config?.schema as { uiSchema: { version: string } }).uiSchema.version).toBe('1.0.0');
  });

  it('updates ui schema and persists version bump', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'core-runtime-store-update-'));
    const storeA = new FileConfigStore({ baseDir });

    await storeA.createConfig({
      id: 'orders',
      schema: { uiSchema: { version: '1.0.0' } },
    });
    await storeA.updateSchema('orders', { uiSchema: { version: '1.1.0' } });

    const storeB = new FileConfigStore({ baseDir });
    const config = await storeB.getConfig('orders');
    expect((config?.schema as { uiSchema: { version: string } }).uiSchema.version).toBe('1.1.0');
  });

  it('adds and approves a version', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'core-runtime-store-version-'));
    const store = new TmpConfigStore({ baseDir });

    await store.createConfig({
      id: 'orders',
      schema: { uiSchema: { version: '1.0.0' } },
    });
    await store.addVersion('orders', {
      id: 'ver-1.1.0',
      schema: { uiSchema: { version: '1.1.0' } },
    });
    await store.approveVersion('orders', 'ver-1.1.0');

    const config = await store.getConfig('orders');
    expect(config?.versions[0]?.id).toBe('ver-1.1.0');
    expect(config?.versions[0]?.approved).toBe(true);
    expect(config?.versions[0]?.approvedAt).toBeTruthy();

    const configs = await store.listConfigs();
    expect(configs).toHaveLength(1);
  });
});
