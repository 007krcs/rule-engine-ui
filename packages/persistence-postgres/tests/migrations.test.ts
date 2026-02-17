import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(testDir, '..', 'migrations');

async function readMigration(name: string): Promise<string> {
  return await fs.readFile(path.join(migrationsDir, name), 'utf8');
}

describe('postgres migrations', () => {
  it('creates enterprise tables', async () => {
    const migration = await readMigration('0001_enterprise_core.sql');
    const requiredTables = [
      'tenants',
      'users',
      'roles',
      'config_packages',
      'config_versions',
      'approvals_reviews',
      'audit_events',
      'execution_traces',
      'feature_flags',
      'kill_switches',
      'tenant_branding',
    ];

    for (const table of requiredTables) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('enables tenant RLS policies', async () => {
    const migration = await readMigration('0002_tenant_rls.sql');
    const protectedTables = [
      'config_packages',
      'config_versions',
      'approvals_reviews',
      'audit_events',
      'execution_traces',
      'feature_flags',
      'kill_switches',
      'tenant_branding',
    ];

    for (const table of protectedTables) {
      expect(migration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }
  });

  it('adds fail-closed restrictive tenant guard policies', async () => {
    const migration = await readMigration('0002_rls_and_guards.sql');
    const guardedTables = [
      'users',
      'user_roles',
      'config_packages',
      'config_versions',
      'approvals_reviews',
      'audit_events',
      'execution_traces',
      'feature_flags',
      'kill_switches',
      'tenant_branding',
      'policy_bindings',
    ];

    expect(migration).toContain('CREATE OR REPLACE FUNCTION app_current_tenant_required()');
    expect(migration).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC');
    expect(migration).toContain('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC');

    for (const table of guardedTables) {
      expect(migration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      expect(migration).toContain(`CREATE POLICY tenant_required_${table} ON ${table}`);
      expect(migration).toContain('AS RESTRICTIVE');
    }
  });
});
