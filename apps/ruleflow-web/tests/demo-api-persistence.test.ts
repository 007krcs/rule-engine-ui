import { beforeEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';

describe('demo api persistence integration', () => {
  beforeEach(() => {
    delete process.env.VERCEL;
    delete process.env.RULEFLOW_DEMO_TMP_STORE_DIR;
    delete process.env.RULEFLOW_GITOPS_HMAC_KEY;
  });

  it('creates package, patches ui schema, and console reflects persisted changes', async () => {
    const storeDir = await mkdtemp(path.join(os.tmpdir(), 'ruleflow-demo-api-'));
    process.env.RULEFLOW_DEMO_STORE_DIR = storeDir;

    vi.resetModules();

    const systemResetRoute = await import('../src/app/api/system/reset/route');
    const configPackagesRoute = await import('../src/app/api/config-packages/route');
    const uiSchemaRoute = await import('../src/app/api/config-versions/[versionId]/ui-schema/route');
    const repository = await import('../src/server/demo/repository');
    const consoleRoute = await import('../src/app/api/console/route');

    await systemResetRoute.POST();

    const createRequest = new Request('http://localhost/api/config-packages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Integration Package',
        description: 'Persistence integration test',
      }),
    });

    const createResponse = await configPackagesRoute.POST(createRequest);
    expect(createResponse.status).toBe(200);

    const created = (await createResponse.json()) as {
      ok: boolean;
      packageId: string;
      versionId: string;
    };

    expect(created.ok).toBe(true);
    expect(created.packageId).toBeTruthy();
    expect(created.versionId).toBeTruthy();

    const currentVersion = await repository.getConfigVersion(created.versionId);
    expect(currentVersion).toBeTruthy();

    const patchedUiSchema = {
      ...currentVersion!.bundle.uiSchema,
      version: '9.9.9-integration',
    };

    const patchResponse = await uiSchemaRoute.PATCH(
      new Request(`http://localhost/api/config-versions/${created.versionId}/ui-schema`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          uiSchema: patchedUiSchema,
        }),
      }),
      {
        params: Promise.resolve({ versionId: created.versionId }),
      },
    );

    expect(patchResponse.status).toBe(200);
    const patchPayload = (await patchResponse.json()) as { ok: boolean };
    expect(patchPayload.ok).toBe(true);

    const consoleResponse = await consoleRoute.GET();
    expect(consoleResponse.status).toBe(200);

    const snapshot = (await consoleResponse.json()) as {
      versions: Array<{ id: string; bundle: { uiSchema: { version?: string } } }>;
    };

    const updatedVersion = snapshot.versions.find((version) => version.id === created.versionId);
    expect(updatedVersion).toBeTruthy();
    expect(updatedVersion?.bundle.uiSchema.version).toBe('9.9.9-integration');
  });
});
