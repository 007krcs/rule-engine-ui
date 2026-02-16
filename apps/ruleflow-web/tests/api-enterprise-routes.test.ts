import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMock = vi.hoisted(() => ({
  getConfigStore: vi.fn(async () => ({ provider: 'postgres' })),
  getStoreDiagnostics: vi.fn(async () => ({
    provider: 'postgres',
    baseDir: null,
    canWriteToStore: true,
  })),
  isPersistenceError: vi.fn(() => false),
  createConfigPackage: vi.fn(async () => ({ packageId: 'pkg-1', versionId: 'ver-1' })),
  createConfigVersion: vi.fn(async () => ({ ok: true, versionId: 'ver-2' })),
  listFeatureFlags: vi.fn(async () => ({ ok: true, flags: [] })),
  upsertFeatureFlag: vi.fn(async () => ({
    ok: true,
    flag: { id: 'flag-1', env: 'prod', key: 'rules.explain', enabled: true },
  })),
  requestChanges: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/server/repository', () => repositoryMock);

describe('enterprise api routes', () => {
  beforeEach(() => {
    repositoryMock.getConfigStore.mockResolvedValue({ provider: 'postgres' });
    repositoryMock.getStoreDiagnostics.mockResolvedValue({
      provider: 'postgres',
      baseDir: null,
      canWriteToStore: true,
    });
    repositoryMock.isPersistenceError.mockReturnValue(false);
    repositoryMock.createConfigPackage.mockResolvedValue({ packageId: 'pkg-1', versionId: 'ver-1' });
    repositoryMock.createConfigVersion.mockResolvedValue({ ok: true, versionId: 'ver-2' });
    repositoryMock.listFeatureFlags.mockResolvedValue({ ok: true, flags: [] });
    repositoryMock.upsertFeatureFlag.mockResolvedValue({
      ok: true,
      flag: { id: 'flag-1', env: 'prod', key: 'rules.explain', enabled: true },
    });
    repositoryMock.requestChanges.mockResolvedValue({ ok: true });
  });

  it('returns 403 when create package is blocked by policy', async () => {
    repositoryMock.createConfigPackage.mockResolvedValueOnce({
      ok: false,
      error: 'policy_failed',
      policyErrors: [],
    });
    const route = await import('../src/app/api/config-packages/route');

    const response = await route.POST(
      new Request('http://localhost/api/config-packages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Orders' }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it('returns 403 when create version is blocked by policy', async () => {
    repositoryMock.createConfigVersion.mockResolvedValueOnce({
      ok: false,
      error: 'policy_failed',
      policyErrors: [],
    });
    const route = await import('../src/app/api/config-packages/[packageId]/versions/route');

    const response = await route.POST(
      new Request('http://localhost/api/config-packages/pkg-1/versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ packageId: 'pkg-1' }) },
    );

    expect(response.status).toBe(403);
  });

  it('returns 403 when feature flag update is blocked by policy', async () => {
    repositoryMock.upsertFeatureFlag.mockResolvedValueOnce({
      ok: false,
      error: 'policy_failed',
      policyErrors: [],
    });
    const route = await import('../src/app/api/feature-flags/route');

    const response = await route.POST(
      new Request('http://localhost/api/feature-flags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ env: 'prod', key: 'rules.explain', enabled: true }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it('returns 403 when request changes is blocked by policy', async () => {
    repositoryMock.requestChanges.mockResolvedValueOnce({
      ok: false,
      error: 'policy_failed',
      policyErrors: [],
    });
    const route = await import('../src/app/api/approvals/[approvalId]/request-changes/route');

    const response = await route.POST(
      new Request('http://localhost/api/approvals/apr-1/request-changes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 'Needs updates' }),
      }),
      { params: Promise.resolve({ approvalId: 'apr-1' }) },
    );

    expect(response.status).toBe(403);
  });

  it('exposes prometheus metrics endpoint', async () => {
    const route = await import('../src/app/api/metrics/route');
    const response = await route.GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
  });
});
