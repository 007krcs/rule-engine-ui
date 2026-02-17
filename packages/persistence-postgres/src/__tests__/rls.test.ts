import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresTenantRepository } from '../repository';
import { createSqlPoolFromPg, type SqlClient, type SqlPool } from '../sql-client';
import type { JsonRecord, RepoSession } from '../types';

const connectionString = process.env.RULEFLOW_PG_INTEGRATION_URL ?? process.env.DATABASE_URL;
const describeIfDb = connectionString ? describe : describe.skip;

function sampleBundle(): JsonRecord {
  return {
    uiSchema: { version: '1.0.0', root: { id: 'root' } },
    flowSchema: { version: '1.0.0' },
    rules: { version: '1.0.0', rules: [] },
    apiMappingsById: {},
  };
}

function buildSession(prefix: string): RepoSession {
  const token = crypto.randomUUID().slice(0, 8);
  return {
    tenantId: `${prefix}-${token}`,
    userId: `user-${token}`,
    userName: `${prefix}-user`,
    roles: ['Author', 'Approver', 'Publisher'],
  };
}

async function withTenant<T>(pool: SqlPool, tenantId: string, fn: (client: SqlClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    const result = await fn(client);
    await client.query('ROLLBACK');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

describeIfDb('postgres rls and lifecycle hardening', () => {
  let pool: SqlPool;
  let repo: PostgresTenantRepository;

  beforeAll(async () => {
    pool = await createSqlPoolFromPg({ connectionString: connectionString! });
    repo = await PostgresTenantRepository.create({
      pool,
      runMigrationsOnBoot: true,
    });
  });

  afterAll(async () => {
    await repo.close();
    await pool.end();
  });

  it('prevents tenant cross-read for config_versions', async () => {
    const sessionA = buildSession('tenant-a');
    const sessionB = buildSession('tenant-b');

    const packageIdA = `pkg-${crypto.randomUUID().slice(0, 8)}`;
    const versionIdA = `ver-${crypto.randomUUID().slice(0, 8)}`;
    const packageIdB = `pkg-${crypto.randomUUID().slice(0, 8)}`;
    const versionIdB = `ver-${crypto.randomUUID().slice(0, 8)}`;

    await repo.createConfigPackage({
      session: sessionA,
      packageId: packageIdA,
      configId: packageIdA,
      name: 'A package',
      versionId: versionIdA,
      versionLabel: '0.1.0',
      bundle: sampleBundle(),
    });

    await repo.createConfigPackage({
      session: sessionB,
      packageId: packageIdB,
      configId: packageIdB,
      name: 'B package',
      versionId: versionIdB,
      versionLabel: '0.1.0',
      bundle: sampleBundle(),
    });

    const ownRead = await withTenant(pool, sessionA.tenantId, async (client) =>
      client.query<{ id: string }>('SELECT id FROM config_versions WHERE id = $1', [versionIdA]),
    );
    expect(ownRead.rowCount).toBe(1);

    const crossRead = await withTenant(pool, sessionA.tenantId, async (client) =>
      client.query<{ id: string }>('SELECT id FROM config_versions WHERE id = $1', [versionIdB]),
    );
    expect(crossRead.rowCount).toBe(0);
  });

  it('blocks SELECT when app.tenant_id is unset', async () => {
    const session = buildSession('tenant-rls');
    const packageId = `pkg-${crypto.randomUUID().slice(0, 8)}`;
    const versionId = `ver-${crypto.randomUUID().slice(0, 8)}`;

    await repo.createConfigPackage({
      session,
      packageId,
      configId: packageId,
      name: 'RLS package',
      versionId,
      versionLabel: '0.1.0',
      bundle: sampleBundle(),
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expect(client.query('SELECT id FROM config_versions LIMIT 1')).rejects.toThrow(/app\.tenant_id must be set/i);
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  });

  it('rejects editing non-DRAFT versions', async () => {
    const session = buildSession('tenant-lifecycle');
    const packageId = `pkg-${crypto.randomUUID().slice(0, 8)}`;
    const versionId = `ver-${crypto.randomUUID().slice(0, 8)}`;

    await repo.createConfigPackage({
      session,
      packageId,
      configId: packageId,
      name: 'Lifecycle package',
      versionId,
      versionLabel: '0.1.0',
      bundle: sampleBundle(),
    });

    const submitted = await repo.submitForReview({
      session,
      versionId,
      scope: 'Lifecycle guard check',
      risk: 'Low',
    });
    expect(submitted.ok).toBe(true);

    const updateResult = await repo.updateVersionBundle({
      session,
      versionId,
      action: 'Attempted update after review',
      mutate: (bundle) => ({ ...bundle, marker: 'should-not-save' }),
    });

    expect(updateResult.ok).toBe(false);
    if (updateResult.ok) return;
    expect(updateResult.error).toMatch(/Only DRAFT versions can be edited/i);
  });
});
