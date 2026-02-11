import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp } from 'node:fs/promises';

async function loadRepo(tempDir: string) {
  process.env.RULEFLOW_DEMO_STORE_DIR = tempDir;
  // Module has process-scoped singletons; reset between tests.
  vi.resetModules();
  return await import('../src/server/demo/repository');
}

describe('demo repository', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'ruleflow-demo-'));
  });

  it('creates a package, submits for review, approves, and promotes', async () => {
    const repo = await loadRepo(tempDir);

    await repo.resetDemoStore();

    const created = await repo.createConfigPackage({ name: 'My Package', description: 'Test' });
    // packageId is derived from configId/name (sanitized) to match how enterprise configIds work.
    expect(created.packageId).toBe('my-package');
    expect(created.versionId).toMatch(/^ver-/);

    const draft = await repo.getConfigVersion(created.versionId);
    expect(draft?.status).toBe('DRAFT');

    const submit = await repo.submitForReview({
      versionId: created.versionId,
      scope: 'Tenant: Test',
      risk: 'Low',
    });
    expect(submit.ok).toBe(true);

    const snap1 = await repo.getConsoleSnapshot();
    const approval = snap1.approvals.find((a) => a.versionId === created.versionId && a.status === 'PENDING');
    expect(approval).toBeTruthy();

    const approve = await repo.approveRequest({ approvalId: approval!.id });
    expect(approve.ok).toBe(true);

    const approved = await repo.getConfigVersion(created.versionId);
    expect(approved?.status).toBe('APPROVED');

    const promote = await repo.promoteVersion({ versionId: created.versionId });
    expect(promote.ok).toBe(true);

    const active = await repo.getConfigVersion(created.versionId);
    expect(active?.status).toBe('ACTIVE');
  });

  it('exports and imports a GitOps bundle', async () => {
    const repo = await loadRepo(tempDir);

    await repo.resetDemoStore();
    const exported = await repo.exportGitOpsBundle();
    expect(exported.schemaVersion).toBe(1);
    expect(exported.tenantId).toBeTruthy();
    expect(exported.signature.alg).toBe('HMAC-SHA256');
    expect(exported.signature.value).toBeTruthy();
    expect(exported.payload.packages.length).toBeGreaterThan(0);

    const importResult = await repo.importGitOpsBundle({ bundle: exported });
    expect(importResult.ok).toBe(true);

    const snap = await repo.getConsoleSnapshot();
    expect(snap.packages.length).toBe(exported.payload.packages.length);
  });
});
