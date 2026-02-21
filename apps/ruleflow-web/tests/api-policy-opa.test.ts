import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMock = vi.hoisted(() => ({
  getConfigStore: vi.fn(async () => ({ provider: 'postgres' })),
  getStoreDiagnostics: vi.fn(async () => ({
    provider: 'postgres',
    baseDir: null,
    canWriteToStore: true,
  })),
  isPersistenceError: vi.fn(() => false),
  createConfigPackage: vi.fn(async () => ({ packageId: 'pkg-1', versionId: 'ver-1' })),
}));

vi.mock('@/server/repository', () => repositoryMock);

describe('api policy guard with OPA', () => {
  beforeEach(() => {
    vi.resetModules();
    repositoryMock.getConfigStore.mockResolvedValue({ provider: 'postgres' });
    repositoryMock.getStoreDiagnostics.mockResolvedValue({
      provider: 'postgres',
      baseDir: null,
      canWriteToStore: true,
    });
    repositoryMock.isPersistenceError.mockReturnValue(false);
    repositoryMock.createConfigPackage.mockResolvedValue({ packageId: 'pkg-1', versionId: 'ver-1' });

    process.env.OPA_URL = 'http://opa.local';
    process.env.OPA_PACKAGE = 'ruleflow/allow';
    process.env.OPA_TIMEOUT_MS = '500';
    process.env.RULEFLOW_OPA_MODE = 'enforce';

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            result: {
              allow: false,
              reason: 'OPA denied stage save for this user',
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }),
    );
  });

  afterEach(() => {
    delete process.env.OPA_URL;
    delete process.env.OPA_PACKAGE;
    delete process.env.OPA_TIMEOUT_MS;
    delete process.env.RULEFLOW_OPA_MODE;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('rejects config package creation before repository mutation when OPA denies', async () => {
    const route = await import('../src/app/api/config-packages/route');

    const response = await route.POST(
      new Request('http://localhost/api/config-packages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Orders' }),
      }),
    );

    expect(response.status).toBe(403);
    const payload = (await response.json()) as { error?: string; policyErrors?: Array<{ code?: string }> };
    expect(payload.error).toBe('policy_failed');
    expect(payload.policyErrors?.some((error) => error.code === 'opa_denied')).toBe(true);
    expect(repositoryMock.createConfigPackage).not.toHaveBeenCalled();
  });
});
