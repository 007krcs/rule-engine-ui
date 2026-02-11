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
    delete process.env.RULEFLOW_DEMO_STORE_DIR;
    delete process.env.RULEFLOW_DEMO_TMP_STORE_DIR;
    delete process.env.VERCEL;
  });

  it('selects tmp store when VERCEL=1', async () => {
    const repo = await loadRepository();
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ruleflow-demo-tmp-'));

    const store = await repo.createConfigStoreForTests({
      defaultDir: path.join(tmpDir, 'default'),
      tmpDir,
      vercel: '1',
      canWriteToDirectory: async (dir) => dir === tmpDir,
    });

    expect(store.provider).toBe('tmp');
    expect(store.baseDir).toBe(tmpDir);
  });

  it('uses tmp store when primary filesystem path is not writable', async () => {
    const repo = await loadRepository();
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ruleflow-demo-tmp-'));
    const defaultDir = path.join(tmpDir, 'readonly-default');

    const store = await repo.createConfigStoreForTests({
      defaultDir,
      tmpDir,
      vercel: '0',
      canWriteToDirectory: async (dir) => dir === tmpDir,
    });

    expect(store.provider).toBe('tmp');
    expect(store.baseDir).toBe(tmpDir);
  });

  it('falls back to in-memory store when writes fail everywhere', async () => {
    const repo = await loadRepository();

    const store = await repo.createConfigStoreForTests({
      defaultDir: '/not-writable/default',
      tmpDir: '/not-writable/tmp',
      vercel: '0',
      canWriteToDirectory: async () => false,
    });

    expect(store.provider).toBe('memory');
    expect(store.canWriteToStore).toBe(false);
    expect(store.warning).toContain('Falling back to in-memory store');
  });
});

describe('demo config store read/write behavior', () => {
  beforeEach(() => {
    delete process.env.RULEFLOW_DEMO_STORE_DIR;
    delete process.env.RULEFLOW_DEMO_TMP_STORE_DIR;
    delete process.env.VERCEL;
  });

  it('persists state for file store across store instances', async () => {
    const repo = await loadRepository();
    const defaultDir = await mkdtemp(path.join(os.tmpdir(), 'ruleflow-demo-file-'));
    const tmpDir = path.join(defaultDir, 'tmp-fallback');

    const storeA = await repo.createConfigStoreForTests({
      defaultDir,
      tmpDir,
      vercel: '0',
      canWriteToDirectory: async (dir) => dir === defaultDir,
    });

    const before = await storeA.readState();
    await storeA.replaceState({
      ...before,
      tenantId: 'tenant-store-test',
    });

    const storeB = await repo.createConfigStoreForTests({
      defaultDir,
      tmpDir,
      vercel: '0',
      canWriteToDirectory: async (dir) => dir === defaultDir,
    });

    const after = await storeB.readState();
    expect(after.tenantId).toBe('tenant-store-test');
  });

  it('supports package/version create-read-update-list operations', async () => {
    const repo = await loadRepository();
    const defaultDir = await mkdtemp(path.join(os.tmpdir(), 'ruleflow-demo-crud-'));
    const tmpDir = path.join(defaultDir, 'tmp-fallback');

    const store = await repo.createConfigStoreForTests({
      defaultDir,
      tmpDir,
      vercel: '0',
      canWriteToDirectory: async (dir) => dir === defaultDir,
    });

    const seeded = await store.readState();
    const template = seeded.packages[0];
    expect(template).toBeTruthy();

    const nextPackageId = 'pkg-store-crud';
    const nextVersionId = 'ver-store-crud';

    const clonedPackage = JSON.parse(JSON.stringify(template!)) as (typeof seeded.packages)[number];
    clonedPackage.id = nextPackageId;
    clonedPackage.configId = nextPackageId;
    clonedPackage.name = 'Store CRUD Package';
    clonedPackage.versions = clonedPackage.versions.slice(0, 1).map((version) => ({
      ...version,
      id: nextVersionId,
      packageId: nextPackageId,
      version: '0.2.0',
    }));

    await store.createPackage(clonedPackage);

    const packages = await store.listPackages();
    expect(packages.some((pkg) => pkg.id === nextPackageId)).toBe(true);

    const updated = await store.updateVersion(nextVersionId, (version) => ({
      ...version,
      version: '0.3.0',
    }));

    expect(updated).toBe(true);

    const version = await store.readVersion(nextVersionId);
    expect(version?.version).toBe('0.3.0');
  });
});
