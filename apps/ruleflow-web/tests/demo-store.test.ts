import { beforeEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';

async function loadRepository() {
  vi.resetModules();
  return await import('../src/server/demo/repository');
}

describe('demo config store selection', () => {
  beforeEach(() => {
    delete process.env.VERCEL;
  });

  it('selects tmp store when VERCEL=1', async () => {
    const repo = await loadRepository();
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ruleflow-demo-tmp-'));

    const store = await repo.createConfigStoreForTests({
      defaultDir: path.join(tmpDir, 'default'),
      tmpDir,
      vercel: '1',
    });

    expect(store.provider).toBe('tmp');
    expect(store.baseDir).toBe(tmpDir);
  });

  it('selects file store by default', async () => {
    const repo = await loadRepository();
    const defaultDir = await mkdtemp(path.join(os.tmpdir(), 'ruleflow-demo-file-'));

    const store = await repo.createConfigStoreForTests({
      defaultDir,
      vercel: '0',
    });

    expect(store.provider).toBe('file');
    expect(store.baseDir).toBe(defaultDir);
  });
});

describe('demo config store operations', () => {
  it('supports create, update schema, add version, approve version, and list', async () => {
    const repo = await loadRepository();
    const defaultDir = await mkdtemp(path.join(os.tmpdir(), 'ruleflow-demo-crud-'));

    const store = await repo.createConfigStoreForTests({
      defaultDir,
      vercel: '0',
    });

    await store.createConfig({
      id: 'orders-config',
      schema: {
        uiSchema: { version: '1.0.0' },
      },
    });

    await store.updateSchema('orders-config', {
      uiSchema: { version: '1.1.0' },
    });

    await store.addVersion('orders-config', {
      id: 'ver-1.1.0',
      schema: { uiSchema: { version: '1.1.0' } },
    });

    await store.approveVersion('orders-config', 'ver-1.1.0');

    const config = await store.getConfig('orders-config');
    expect(config).toBeTruthy();
    expect((config?.schema as { uiSchema: { version: string } }).uiSchema.version).toBe('1.1.0');
    expect(config?.versions[0]?.id).toBe('ver-1.1.0');
    expect(config?.versions[0]?.approved).toBe(true);

    const allConfigs = await store.listConfigs();
    expect(allConfigs.some((item) => item.id === 'orders-config')).toBe(true);
  });
});
