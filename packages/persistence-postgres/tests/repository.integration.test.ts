import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresTenantRepository } from '../src/repository';
import type { RepoSession } from '../src/types';

const connectionString = process.env.RULEFLOW_PG_INTEGRATION_URL ?? process.env.DATABASE_URL;
const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb('postgres repository integration', () => {
  let repo: PostgresTenantRepository;
  let session: RepoSession;
  const tenantId = `tenant-int-${crypto.randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    repo = await PostgresTenantRepository.create({
      connectionString,
      runMigrationsOnBoot: true,
    });
    session = {
      tenantId,
      userId: `user-${crypto.randomUUID().slice(0, 8)}`,
      userName: 'Integration User',
      roles: ['Author', 'Approver', 'Publisher'],
    };
  });

  afterAll(async () => {
    await repo.close();
  });

  it('executes create -> review -> approve -> promote lifecycle', async () => {
    const bundle = {
      uiSchema: { version: '1.0.0' },
      flowSchema: { version: '1.0.0' },
      rules: { version: '1.0.0', rules: [] },
      apiMappingsById: {},
    };

    const packageId = `pkg-${crypto.randomUUID().slice(0, 8)}`;
    const versionId = `ver-${crypto.randomUUID().slice(0, 8)}`;

    await repo.createConfigPackage({
      session,
      packageId,
      configId: packageId,
      name: 'Integration Package',
      versionId,
      versionLabel: '0.1.0',
      bundle,
    });

    const submit = await repo.submitForReview({
      session,
      versionId,
      scope: 'Tenant integration check',
      risk: 'Low',
    });
    expect(submit.ok).toBe(true);
    if (!submit.ok) return;

    const approved = await repo.approveReview({
      session,
      approvalId: submit.approvalId,
    });
    expect(approved.ok).toBe(true);

    const promoted = await repo.promoteVersion({ session, versionId });
    expect(promoted.ok).toBe(true);

    const version = await repo.getConfigVersion(session.tenantId, versionId);
    expect(version?.status).toBe('ACTIVE');
  });

  it('persists flags and kill switch', async () => {
    const flag = await repo.upsertFeatureFlag({
      session,
      env: 'prod',
      key: 'rules.explainMode',
      enabled: true,
      value: { rollout: 100 },
    });
    expect(flag.enabled).toBe(true);

    const killSwitch = await repo.upsertKillSwitch({
      session,
      scope: 'TENANT',
      active: true,
      reason: 'integration-test',
    });
    expect(killSwitch.active).toBe(true);
  });
});
