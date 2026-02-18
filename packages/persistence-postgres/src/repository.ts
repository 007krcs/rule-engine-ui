import crypto from 'node:crypto';
import type { SqlClient, SqlPool } from './sql-client';
import { createSqlPoolFromPg } from './sql-client';
import { runPostgresMigrations } from './migrations';
import type {
  ApprovalStatus,
  AuditSeverity,
  ConfigStatus,
  GitOpsPayload,
  JsonRecord,
  KillScope,
  RepoApproval,
  RepoAuditEvent,
  RepoBranding,
  RepoConfigPackage,
  RepoConfigVersion,
  RepoConsoleSnapshot,
  RepoExecutionTrace,
  RepoFeatureFlag,
  RepoKillSwitch,
  RepoSession,
  RiskLevel,
} from './types';

type PackageRow = {
  id: string;
  tenant_id: string;
  config_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
};

type VersionRow = {
  id: string;
  tenant_id: string;
  package_id: string;
  version: string;
  status: ConfigStatus;
  bundle: unknown;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
  is_killed: boolean;
  kill_reason: string | null;
};

type ApprovalRow = {
  id: string;
  tenant_id: string;
  package_id: string;
  version_id: string;
  requested_by: string;
  requested_at: string;
  scope: string;
  risk: string;
  status: ApprovalStatus;
  decided_by: string | null;
  decided_at: string | null;
  notes: string | null;
};

type AuditRow = {
  id: string;
  tenant_id: string;
  actor: string;
  action: string;
  target: string;
  severity: AuditSeverity;
  metadata: unknown;
  at: string;
};

type FeatureFlagRow = {
  id: string;
  tenant_id: string;
  env: string;
  flag_key: string;
  enabled: boolean;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
};

type KillSwitchRow = {
  id: string;
  tenant_id: string;
  scope: KillScope;
  package_id: string | null;
  version_id: string | null;
  ruleset_key: string | null;
  active: boolean;
  reason: string | null;
  updated_by: string | null;
  updated_at: string;
};

type BrandingRow = {
  tenant_id: string;
  logo_url: string | null;
  mode: string;
  primary_color: string;
  secondary_color: string;
  typography_scale: string | number;
  radius: number;
  spacing: number;
  css_variables: unknown;
  updated_by: string | null;
  updated_at: string;
};

type TraceRow = {
  id: string;
  tenant_id: string;
  execution_id: string;
  correlation_id: string;
  package_id: string | null;
  version_id: string | null;
  trace: unknown;
  cold_storage_uri: string | null;
  created_at: string;
};

export interface PostgresRepositoryOptions {
  connectionString?: string;
  pool?: SqlPool;
  runMigrationsOnBoot?: boolean;
}

export class PostgresTenantRepository {
  private readonly pool: SqlPool;
  private readonly ownPool: boolean;

  private constructor(pool: SqlPool, ownPool: boolean) {
    this.pool = pool;
    this.ownPool = ownPool;
  }

  static async create(options: PostgresRepositoryOptions = {}): Promise<PostgresTenantRepository> {
    const ownPool = !options.pool;
    const pool =
      options.pool ??
      (await createSqlPoolFromPg({
        connectionString: requiredConnectionString(options.connectionString),
      }));
    if (options.runMigrationsOnBoot ?? true) {
      await runPostgresMigrations({ pool });
    }
    return new PostgresTenantRepository(pool, ownPool);
  }

  async close(): Promise<void> {
    if (this.ownPool) {
      await this.pool.end();
    }
  }

  async ensureSession(session: RepoSession): Promise<void> {
    await this.withTenantTransaction(session.tenantId, async (client) => {
      await client.query(
        `
          INSERT INTO tenants (id, name)
          VALUES ($1, $2)
          ON CONFLICT (id) DO NOTHING
        `,
        [session.tenantId, session.tenantId],
      );
      await client.query(
        `
          INSERT INTO users (tenant_id, id, email, name)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (tenant_id, id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
        `,
        [session.tenantId, session.userId, `${session.userId}@ruleflow.local`, session.userName],
      );
      for (const role of session.roles) {
        await client.query(
          `INSERT INTO roles (id, description) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
          [role, `${role} role`],
        );
        await client.query(
          `
            INSERT INTO user_roles (tenant_id, user_id, role_id, assigned_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING
          `,
          [session.tenantId, session.userId, role, session.userName],
        );
      }
    });
  }

  async getConsoleSnapshot(tenantId: string): Promise<RepoConsoleSnapshot> {
    return await this.withTenantTransaction(tenantId, async (client) => {
      const packages = (
        await client.query<PackageRow>(
          `
            SELECT id, tenant_id, config_id, name, description, created_by, created_at
            FROM config_packages
            WHERE tenant_id = $1
            ORDER BY created_at DESC
          `,
          [tenantId],
        )
      ).rows.map(mapPackage);

      const versions = (
        await client.query<VersionRow>(
          `
            SELECT id, tenant_id, package_id, version, status, bundle, created_by, created_at, updated_by, updated_at, is_killed, kill_reason
            FROM config_versions
            WHERE tenant_id = $1
            ORDER BY created_at DESC
          `,
          [tenantId],
        )
      ).rows.map(mapVersion);

      const approvals = (
        await client.query<ApprovalRow>(
          `
            SELECT id, tenant_id, package_id, version_id, requested_by, requested_at, scope, risk, status, decided_by, decided_at, notes
            FROM approvals_reviews
            WHERE tenant_id = $1
            ORDER BY requested_at DESC
          `,
          [tenantId],
        )
      ).rows.map(mapApproval);

      const audit = (
        await client.query<AuditRow>(
          `
            SELECT id, tenant_id, actor, action, target, severity, metadata, at
            FROM audit_events
            WHERE tenant_id = $1
            ORDER BY at DESC
            LIMIT 500
          `,
          [tenantId],
        )
      ).rows.map(mapAuditEvent);

      return { tenantId, packages, versions, approvals, audit };
    });
  }

  async getConfigVersion(tenantId: string, versionId: string): Promise<RepoConfigVersion | null> {
    return await this.withTenantTransaction(tenantId, async (client) => {
      const result = await client.query<VersionRow>(
        `
          SELECT id, tenant_id, package_id, version, status, bundle, created_by, created_at, updated_by, updated_at, is_killed, kill_reason
          FROM config_versions
          WHERE tenant_id = $1 AND id = $2
          LIMIT 1
        `,
        [tenantId, versionId],
      );
      const row = result.rows[0];
      return row ? mapVersion(row) : null;
    });
  }

  async createConfigPackage(input: {
    session: RepoSession;
    packageId: string;
    configId: string;
    name: string;
    description?: string;
    versionId: string;
    versionLabel: string;
    bundle: JsonRecord;
  }): Promise<{ packageId: string; versionId: string }> {
    const { session } = input;
    await this.ensureSession(session);
    const normalizedBundle = normalizeBundleUiPages(input.bundle);

    await this.withTenantTransaction(session.tenantId, async (client) => {
      await client.query(
        `
          INSERT INTO config_packages (id, tenant_id, config_id, name, description, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [input.packageId, session.tenantId, input.configId, input.name, input.description ?? null, session.userName],
      );
      await client.query(
        `
          INSERT INTO config_versions (id, tenant_id, package_id, version, status, bundle, created_by)
          VALUES ($1, $2, $3, $4, 'DRAFT', $5::jsonb, $6)
        `,
        [
          input.versionId,
          session.tenantId,
          input.packageId,
          input.versionLabel,
          JSON.stringify(normalizedBundle),
          session.userName,
        ],
      );
      await this.insertAudit(client, {
        tenantId: session.tenantId,
        actor: session.userName,
        action: 'Created config package',
        target: input.packageId,
        severity: 'info',
        metadata: {
          stage: 'package.create',
          packageId: input.packageId,
          versionId: input.versionId,
          configId: input.configId,
        },
      });
    });

    return { packageId: input.packageId, versionId: input.versionId };
  }

  async createConfigVersion(input: {
    session: RepoSession;
    packageId: string;
    versionId: string;
    versionLabel: string;
    bundle: JsonRecord;
  }): Promise<{ versionId: string }> {
    const { session } = input;
    await this.ensureSession(session);
    const normalizedBundle = normalizeBundleUiPages(input.bundle);

    await this.withTenantTransaction(session.tenantId, async (client) => {
      await client.query(
        `
          INSERT INTO config_versions (id, tenant_id, package_id, version, status, bundle, created_by)
          VALUES ($1, $2, $3, $4, 'DRAFT', $5::jsonb, $6)
        `,
        [
          input.versionId,
          session.tenantId,
          input.packageId,
          input.versionLabel,
          JSON.stringify(normalizedBundle),
          session.userName,
        ],
      );
      await this.insertAudit(client, {
        tenantId: session.tenantId,
        actor: session.userName,
        action: 'Created config version',
        target: `${input.packageId}@${input.versionLabel}`,
        severity: 'info',
        metadata: {
          stage: 'version.create',
          packageId: input.packageId,
          versionId: input.versionId,
          versionLabel: input.versionLabel,
        },
      });
    });

    return { versionId: input.versionId };
  }

  async updateVersionBundle(input: {
    session: RepoSession;
    versionId: string;
    mutate: (bundle: JsonRecord) => JsonRecord;
    action: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    const { session } = input;
    await this.ensureSession(session);

    return await this.withTenantTransaction(session.tenantId, async (client) => {
      const current = await this.loadVersionOrNull(client, session.tenantId, input.versionId);
      if (!current) {
        return { ok: false as const, error: 'Version not found' };
      }
      if (current.status !== 'DRAFT') {
        return {
          ok: false as const,
          error: `Cannot edit version in status ${current.status}. Only DRAFT versions can be edited.`,
        };
      }
      const nextBundle = normalizeBundleUiPages(input.mutate(current.bundle));
      await client.query(
        `
          UPDATE config_versions
          SET bundle = $1::jsonb, updated_by = $2, updated_at = NOW()
          WHERE tenant_id = $3 AND id = $4
        `,
        [JSON.stringify(nextBundle), session.userName, session.tenantId, input.versionId],
      );
      await this.insertAudit(client, {
        tenantId: session.tenantId,
        actor: session.userName,
        action: input.action,
        target: input.versionId,
        severity: 'info',
        metadata: {
          stage: 'version.update_bundle',
          packageId: current.packageId,
          versionId: current.id,
          status: current.status,
        },
      });
      return { ok: true as const };
    });
  }

  async submitForReview(input: {
    session: RepoSession;
    versionId: string;
    scope: string;
    risk: RiskLevel;
  }): Promise<{ ok: true; approvalId: string } | { ok: false; error: string }> {
    const { session } = input;
    await this.ensureSession(session);
    return await this.withTenantTransaction(session.tenantId, async (client) => {
      const version = await this.loadVersionOrNull(client, session.tenantId, input.versionId);
      if (!version) return { ok: false as const, error: 'Version not found' };
      if (version.status !== 'DRAFT') {
        return {
          ok: false as const,
          error: `Cannot submit version in status ${version.status} for review. Expected DRAFT.`,
        };
      }
      if (version.isKilled) {
        return { ok: false as const, error: 'Cannot submit a killed version for review' };
      }

      await client.query(
        `UPDATE config_versions SET status = 'REVIEW', updated_by = $1, updated_at = NOW() WHERE tenant_id = $2 AND id = $3`,
        [session.userName, session.tenantId, input.versionId],
      );

      const approvalId = prefixedId('apr');
      await client.query(
        `
          INSERT INTO approvals_reviews (id, tenant_id, package_id, version_id, requested_by, scope, risk, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
        `,
        [approvalId, session.tenantId, version.packageId, version.id, session.userName, input.scope, input.risk],
      );
      await this.insertAudit(client, {
        tenantId: session.tenantId,
        actor: session.userName,
        action: 'Submitted version for review',
        target: `${version.packageId}@${version.version}`,
        severity: 'info',
        metadata: {
          stage: 'review.submit',
          packageId: version.packageId,
          versionId: version.id,
          approvalId,
          scope: input.scope,
          risk: input.risk,
        },
      });
      return { ok: true as const, approvalId };
    });
  }

  async approveReview(input: { session: RepoSession; approvalId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
    return await this.decideApproval({
      session: input.session,
      approvalId: input.approvalId,
      nextApprovalStatus: 'APPROVED',
      nextVersionStatus: 'APPROVED',
      action: 'Approved change request',
      severity: 'info',
    });
  }

  async requestReviewChanges(input: {
    session: RepoSession;
    approvalId: string;
    notes?: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    return await this.decideApproval({
      session: input.session,
      approvalId: input.approvalId,
      nextApprovalStatus: 'CHANGES_REQUESTED',
      nextVersionStatus: 'DRAFT',
      action: 'Requested changes',
      severity: 'warning',
      notes: input.notes,
    });
  }

  async promoteVersion(input: { session: RepoSession; versionId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
    const { session } = input;
    await this.ensureSession(session);
    return await this.withTenantTransaction(session.tenantId, async (client) => {
      const version = await this.loadVersionOrNull(client, session.tenantId, input.versionId);
      if (!version) return { ok: false as const, error: 'Version not found' };
      if (version.status !== 'APPROVED') return { ok: false as const, error: `Cannot promote version in status ${version.status}` };
      if (version.isKilled) return { ok: false as const, error: 'Cannot promote a killed version' };

      await client.query(
        `
          UPDATE config_versions
          SET status = 'DEPRECATED', updated_by = $1, updated_at = NOW()
          WHERE tenant_id = $2 AND package_id = $3 AND status = 'ACTIVE' AND id <> $4
        `,
        [session.userName, session.tenantId, version.packageId, version.id],
      );
      await client.query(
        `UPDATE config_versions SET status = 'ACTIVE', updated_by = $1, updated_at = NOW() WHERE tenant_id = $2 AND id = $3`,
        [session.userName, session.tenantId, version.id],
      );
      await this.insertAudit(client, {
        tenantId: session.tenantId,
        actor: session.userName,
        action: 'Promoted version to ACTIVE',
        target: `${version.packageId}@${version.version}`,
        severity: 'info',
        metadata: {
          stage: 'version.promote',
          packageId: version.packageId,
          versionId: version.id,
          fromStatus: version.status,
          toStatus: 'ACTIVE',
        },
      });
      return { ok: true as const };
    });
  }

  async rollbackVersion(input: { session: RepoSession; versionId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
    const { session } = input;
    await this.ensureSession(session);
    return await this.withTenantTransaction(session.tenantId, async (client) => {
      const target = await this.loadVersionOrNull(client, session.tenantId, input.versionId);
      if (!target) return { ok: false as const, error: 'Version not found' };
      if (target.status !== 'DEPRECATED') {
        return {
          ok: false as const,
          error: `Cannot rollback to version in status ${target.status}. Expected DEPRECATED.`,
        };
      }
      if (target.isKilled) return { ok: false as const, error: 'Cannot rollback to killed version' };

      await client.query(
        `
          UPDATE config_versions
          SET status = 'DEPRECATED', updated_by = $1, updated_at = NOW()
          WHERE tenant_id = $2 AND package_id = $3 AND status = 'ACTIVE' AND id <> $4
        `,
        [session.userName, session.tenantId, target.packageId, target.id],
      );
      await client.query(
        `UPDATE config_versions SET status = 'ACTIVE', updated_by = $1, updated_at = NOW() WHERE tenant_id = $2 AND id = $3`,
        [session.userName, session.tenantId, target.id],
      );
      await this.insertAudit(client, {
        tenantId: session.tenantId,
        actor: session.userName,
        action: 'Rolled back version',
        target: `${target.packageId}@${target.version}`,
        severity: 'warning',
        metadata: {
          stage: 'version.rollback',
          packageId: target.packageId,
          versionId: target.id,
          fromStatus: target.status,
          toStatus: 'ACTIVE',
        },
      });
      return { ok: true as const };
    });
  }

  async getVersionDiffSource(input: {
    tenantId: string;
    versionId: string;
    againstVersionId?: string | null;
  }): Promise<{ ok: true; packageId: string; before: RepoConfigVersion; after: RepoConfigVersion } | { ok: false; error: string }> {
    return await this.withTenantTransaction(input.tenantId, async (client) => {
      const after = await this.loadVersionOrNull(client, input.tenantId, input.versionId);
      if (!after) return { ok: false as const, error: 'Version not found' };
      const before = input.againstVersionId
        ? await this.loadVersionOrNull(client, input.tenantId, input.againstVersionId)
        : await this.loadCurrentActive(client, input.tenantId, after.packageId, after.id);
      if (!before) return { ok: false as const, error: 'Baseline version not found' };
      return { ok: true as const, packageId: after.packageId, before, after };
    });
  }

  async listFeatureFlags(input: { tenantId: string; env?: string }): Promise<RepoFeatureFlag[]> {
    return await this.withTenantTransaction(input.tenantId, async (client) => {
      const params: unknown[] = [input.tenantId];
      let where = 'tenant_id = $1';
      if (input.env) {
        params.push(input.env);
        where += ` AND env = $${params.length}`;
      }
      const result = await client.query<FeatureFlagRow>(
        `
          SELECT id, tenant_id, env, flag_key, enabled, value, updated_by, updated_at
          FROM feature_flags
          WHERE ${where}
          ORDER BY env, flag_key
        `,
        params,
      );
      return result.rows.map(mapFeatureFlag);
    });
  }

  async upsertFeatureFlag(input: {
    session: RepoSession;
    env: string;
    key: string;
    enabled: boolean;
    value?: JsonRecord;
  }): Promise<RepoFeatureFlag> {
    const { session } = input;
    await this.ensureSession(session);
    return await this.withTenantTransaction(session.tenantId, async (client) => {
      const result = await client.query<FeatureFlagRow>(
        `
          INSERT INTO feature_flags (id, tenant_id, env, flag_key, enabled, value, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
          ON CONFLICT (tenant_id, env, flag_key) DO UPDATE
          SET enabled = EXCLUDED.enabled, value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
          RETURNING id, tenant_id, env, flag_key, enabled, value, updated_by, updated_at
        `,
        [prefixedId('flag'), session.tenantId, input.env, input.key, input.enabled, JSON.stringify(input.value ?? {}), session.userName],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Feature flag write failed');
      await this.insertAudit(client, {
        tenantId: session.tenantId,
        actor: session.userName,
        action: 'Updated feature flag',
        target: `${input.env}:${input.key}`,
        severity: 'info',
        metadata: {
          stage: 'feature_flag.upsert',
          env: input.env,
          key: input.key,
          enabled: input.enabled,
        },
      });
      return mapFeatureFlag(row);
    });
  }

  async listKillSwitches(input: { tenantId: string }): Promise<RepoKillSwitch[]> {
    return await this.withTenantTransaction(input.tenantId, async (client) => {
      const result = await client.query<KillSwitchRow>(
        `
          SELECT id, tenant_id, scope, package_id, version_id, ruleset_key, active, reason, updated_by, updated_at
          FROM kill_switches
          WHERE tenant_id = $1
          ORDER BY updated_at DESC
        `,
        [input.tenantId],
      );
      return result.rows.map(mapKillSwitch);
    });
  }

  async upsertKillSwitch(input: {
    session: RepoSession;
    scope: KillScope;
    active: boolean;
    packageId?: string;
    versionId?: string;
    rulesetKey?: string;
    reason?: string;
  }): Promise<RepoKillSwitch> {
    const { session } = input;
    await this.ensureSession(session);
    return await this.withTenantTransaction(session.tenantId, async (client) => {
      const result = await client.query<KillSwitchRow>(
        `
          INSERT INTO kill_switches (id, tenant_id, scope, package_id, version_id, ruleset_key, active, reason, updated_by)
          VALUES ($1, $2, $3::kill_scope, $4, $5, $6, $7, $8, $9)
          RETURNING id, tenant_id, scope, package_id, version_id, ruleset_key, active, reason, updated_by, updated_at
        `,
        [
          prefixedId('kill'),
          session.tenantId,
          input.scope,
          input.packageId ?? null,
          input.versionId ?? null,
          input.rulesetKey ?? null,
          input.active,
          input.reason ?? null,
          session.userName,
        ],
      );
      if (input.scope === 'VERSION' && input.versionId) {
        await client.query(
          `
            UPDATE config_versions
            SET is_killed = $1, kill_reason = $2, updated_by = $3, updated_at = NOW()
            WHERE tenant_id = $4 AND id = $5
          `,
          [input.active, input.reason ?? null, session.userName, session.tenantId, input.versionId],
        );
      }
      const row = result.rows[0];
      if (!row) throw new Error('Kill switch write failed');
      await this.insertAudit(client, {
        tenantId: session.tenantId,
        actor: session.userName,
        action: 'Updated kill switch',
        target: input.scope,
        severity: input.active ? 'warning' : 'info',
        metadata: {
          stage: 'kill_switch.upsert',
          packageId: input.packageId,
          versionId: input.versionId,
          rulesetKey: input.rulesetKey,
          active: input.active,
        },
      });
      return mapKillSwitch(row);
    });
  }

  async isVersionKilled(input: { tenantId: string; versionId: string; packageId?: string }): Promise<boolean> {
    return await this.withTenantTransaction(input.tenantId, async (client) => {
      const version = await this.loadVersionOrNull(client, input.tenantId, input.versionId);
      if (version?.isKilled) return true;
      const result = await client.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM kill_switches
          WHERE tenant_id = $1
            AND active = TRUE
            AND (scope = 'TENANT' OR (scope = 'VERSION' AND version_id = $2) OR (scope = 'RULESET' AND package_id = $3))
        `,
        [input.tenantId, input.versionId, input.packageId ?? null],
      );
      return Number(result.rows[0]?.count ?? '0') > 0;
    });
  }

  async getBranding(tenantId: string): Promise<RepoBranding | null> {
    return await this.withTenantTransaction(tenantId, async (client) => {
      const result = await client.query<BrandingRow>(
        `
          SELECT tenant_id, logo_url, mode, primary_color, secondary_color, typography_scale, radius, spacing, css_variables, updated_by, updated_at
          FROM tenant_branding
          WHERE tenant_id = $1
          LIMIT 1
        `,
        [tenantId],
      );
      const row = result.rows[0];
      return row ? mapBranding(row) : null;
    });
  }

  async upsertBranding(input: {
    session: RepoSession;
    branding: Omit<RepoBranding, 'tenantId' | 'updatedBy' | 'updatedAt'>;
  }): Promise<RepoBranding> {
    const { session } = input;
    const b = input.branding;
    await this.ensureSession(session);
    return await this.withTenantTransaction(session.tenantId, async (client) => {
      const result = await client.query<BrandingRow>(
        `
          INSERT INTO tenant_branding (tenant_id, logo_url, mode, primary_color, secondary_color, typography_scale, radius, spacing, css_variables, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
          ON CONFLICT (tenant_id) DO UPDATE
          SET logo_url = EXCLUDED.logo_url, mode = EXCLUDED.mode, primary_color = EXCLUDED.primary_color,
              secondary_color = EXCLUDED.secondary_color, typography_scale = EXCLUDED.typography_scale, radius = EXCLUDED.radius,
              spacing = EXCLUDED.spacing, css_variables = EXCLUDED.css_variables, updated_by = EXCLUDED.updated_by, updated_at = NOW()
          RETURNING tenant_id, logo_url, mode, primary_color, secondary_color, typography_scale, radius, spacing, css_variables, updated_by, updated_at
        `,
        [session.tenantId, b.logoUrl ?? null, b.mode, b.primaryColor, b.secondaryColor, b.typographyScale, b.radius, b.spacing, JSON.stringify(b.cssVariables), session.userName],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Branding write failed');
      await this.insertAudit(client, {
        tenantId: session.tenantId,
        actor: session.userName,
        action: 'Updated tenant branding',
        target: session.tenantId,
        severity: 'info',
        metadata: {
          stage: 'branding.upsert',
        },
      });
      return mapBranding(row);
    });
  }

  async addExecutionTrace(input: {
    tenantId: string;
    executionId: string;
    correlationId: string;
    packageId?: string;
    versionId?: string;
    trace: JsonRecord;
    coldStorageUri?: string;
  }): Promise<RepoExecutionTrace> {
    return await this.withTenantTransaction(input.tenantId, async (client) => {
      const result = await client.query<TraceRow>(
        `
          INSERT INTO execution_traces (id, tenant_id, execution_id, correlation_id, package_id, version_id, trace, cold_storage_uri)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
          RETURNING id, tenant_id, execution_id, correlation_id, package_id, version_id, trace, cold_storage_uri, created_at
        `,
        [prefixedId('trace'), input.tenantId, input.executionId, input.correlationId, input.packageId ?? null, input.versionId ?? null, JSON.stringify(input.trace), input.coldStorageUri ?? null],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Execution trace write failed');
      await this.insertAudit(client, {
        tenantId: input.tenantId,
        actor: 'system',
        action: 'Recorded execution trace',
        target: input.executionId,
        severity: 'info',
        metadata: {
          stage: 'execution_trace.insert',
          packageId: input.packageId,
          versionId: input.versionId,
          correlationId: input.correlationId,
        },
      });
      return mapTrace(row);
    });
  }

  async listExecutionTraces(input: { tenantId: string; limit?: number }): Promise<RepoExecutionTrace[]> {
    return await this.withTenantTransaction(input.tenantId, async (client) => {
      const limit = Math.max(1, Math.min(input.limit ?? 100, 1000));
      const result = await client.query<TraceRow>(
        `
          SELECT id, tenant_id, execution_id, correlation_id, package_id, version_id, trace, cold_storage_uri, created_at
          FROM execution_traces
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT $2
        `,
        [input.tenantId, limit],
      );
      return result.rows.map(mapTrace);
    });
  }

  async exportTenantBundle(input: { tenantId: string }): Promise<GitOpsPayload> {
    const snapshot = await this.getConsoleSnapshot(input.tenantId);
    const featureFlags = await this.listFeatureFlags({ tenantId: input.tenantId });
    const killSwitches = await this.listKillSwitches({ tenantId: input.tenantId });
    const branding = await this.getBranding(input.tenantId);
    return {
      packages: snapshot.packages,
      versions: snapshot.versions,
      approvals: snapshot.approvals,
      audit: snapshot.audit,
      featureFlags,
      killSwitches,
      branding,
    };
  }

  async importTenantBundle(input: { session: RepoSession; payload: GitOpsPayload }): Promise<{ ok: true }> {
    const { session, payload } = input;
    await this.ensureSession(session);
    await this.withTenantTransaction(session.tenantId, async (client) => {
      await client.query('DELETE FROM approvals_reviews WHERE tenant_id = $1', [session.tenantId]);
      await client.query('DELETE FROM config_versions WHERE tenant_id = $1', [session.tenantId]);
      await client.query('DELETE FROM config_packages WHERE tenant_id = $1', [session.tenantId]);
      await client.query('DELETE FROM feature_flags WHERE tenant_id = $1', [session.tenantId]);
      await client.query('DELETE FROM kill_switches WHERE tenant_id = $1', [session.tenantId]);
      await client.query('DELETE FROM tenant_branding WHERE tenant_id = $1', [session.tenantId]);
      await client.query('DELETE FROM execution_traces WHERE tenant_id = $1', [session.tenantId]);
      await client.query('DELETE FROM audit_events WHERE tenant_id = $1', [session.tenantId]);

      for (const pkg of payload.packages) {
        await client.query(
          `
            INSERT INTO config_packages (id, tenant_id, config_id, name, description, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)
          `,
          [pkg.id, session.tenantId, pkg.configId, pkg.name, pkg.description ?? null, pkg.createdBy, pkg.createdAt],
        );
      }

      for (const version of payload.versions) {
        await client.query(
          `
            INSERT INTO config_versions (id, tenant_id, package_id, version, status, bundle, created_by, created_at, updated_by, updated_at, is_killed, kill_reason)
            VALUES ($1, $2, $3, $4, $5::config_version_status, $6::jsonb, $7, $8::timestamptz, $9, $10::timestamptz, $11, $12)
          `,
          [
            version.id,
            session.tenantId,
            version.packageId,
            version.version,
            version.status,
            JSON.stringify(normalizeBundleUiPages(version.bundle)),
            version.createdBy,
            version.createdAt,
            version.updatedBy ?? null,
            version.updatedAt ?? null,
            version.isKilled,
            version.killReason ?? null,
          ],
        );
      }

      for (const approval of payload.approvals) {
        await client.query(
          `
            INSERT INTO approvals_reviews (id, tenant_id, package_id, version_id, requested_by, requested_at, scope, risk, status, decided_by, decided_at, notes)
            VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9::approval_status, $10, $11::timestamptz, $12)
          `,
          [
            approval.id,
            session.tenantId,
            approval.packageId,
            approval.versionId,
            approval.requestedBy,
            approval.requestedAt,
            approval.scope,
            approval.risk,
            approval.status,
            approval.decidedBy ?? null,
            approval.decidedAt ?? null,
            approval.notes ?? null,
          ],
        );
      }

      for (const event of payload.audit) {
        await client.query(
          `
            INSERT INTO audit_events (id, tenant_id, actor, action, target, severity, metadata, at)
            VALUES ($1, $2, $3, $4, $5, $6::audit_severity, $7::jsonb, $8::timestamptz)
          `,
          [event.id, session.tenantId, event.actor, event.action, event.target, event.severity, JSON.stringify(event.metadata ?? {}), event.at],
        );
      }

      for (const flag of payload.featureFlags) {
        await client.query(
          `
            INSERT INTO feature_flags (id, tenant_id, env, flag_key, enabled, value, updated_by, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz)
          `,
          [flag.id, session.tenantId, flag.env, flag.key, flag.enabled, JSON.stringify(flag.value), flag.updatedBy ?? null, flag.updatedAt],
        );
      }

      for (const sw of payload.killSwitches) {
        await client.query(
          `
            INSERT INTO kill_switches (id, tenant_id, scope, package_id, version_id, ruleset_key, active, reason, updated_by, updated_at)
            VALUES ($1, $2, $3::kill_scope, $4, $5, $6, $7, $8, $9, $10::timestamptz)
          `,
          [sw.id, session.tenantId, sw.scope, sw.packageId ?? null, sw.versionId ?? null, sw.rulesetKey ?? null, sw.active, sw.reason ?? null, sw.updatedBy ?? null, sw.updatedAt],
        );
      }

      if (payload.branding) {
        const b = payload.branding;
        await client.query(
          `
            INSERT INTO tenant_branding (tenant_id, logo_url, mode, primary_color, secondary_color, typography_scale, radius, spacing, css_variables, updated_by, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::timestamptz)
          `,
          [session.tenantId, b.logoUrl ?? null, b.mode, b.primaryColor, b.secondaryColor, b.typographyScale, b.radius, b.spacing, JSON.stringify(b.cssVariables), b.updatedBy ?? null, b.updatedAt],
        );
      }

      await this.insertAudit(client, {
        tenantId: session.tenantId,
        actor: session.userName,
        action: 'Imported tenant bundle',
        target: session.tenantId,
        severity: 'warning',
        metadata: {
          stage: 'tenant_bundle.import',
          packageCount: payload.packages.length,
          versionCount: payload.versions.length,
          approvalCount: payload.approvals.length,
          auditCount: payload.audit.length,
          featureFlagCount: payload.featureFlags.length,
          killSwitchCount: payload.killSwitches.length,
          hasBranding: Boolean(payload.branding),
        },
      });
    });
    return { ok: true };
  }

  private async loadVersionOrNull(client: SqlClient, tenantId: string, versionId: string): Promise<RepoConfigVersion | null> {
    const result = await client.query<VersionRow>(
      `
        SELECT id, tenant_id, package_id, version, status, bundle, created_by, created_at, updated_by, updated_at, is_killed, kill_reason
        FROM config_versions
        WHERE tenant_id = $1 AND id = $2
        LIMIT 1
      `,
      [tenantId, versionId],
    );
    const row = result.rows[0];
    return row ? mapVersion(row) : null;
  }

  private async loadCurrentActive(client: SqlClient, tenantId: string, packageId: string, excludeId: string): Promise<RepoConfigVersion | null> {
    const result = await client.query<VersionRow>(
      `
        SELECT id, tenant_id, package_id, version, status, bundle, created_by, created_at, updated_by, updated_at, is_killed, kill_reason
        FROM config_versions
        WHERE tenant_id = $1 AND package_id = $2 AND status = 'ACTIVE' AND id <> $3
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [tenantId, packageId, excludeId],
    );
    const row = result.rows[0];
    return row ? mapVersion(row) : null;
  }

  private async decideApproval(input: {
    session: RepoSession;
    approvalId: string;
    nextApprovalStatus: ApprovalStatus;
    nextVersionStatus: ConfigStatus;
    action: string;
    severity: AuditSeverity;
    notes?: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    if (input.nextApprovalStatus === 'APPROVED' && input.nextVersionStatus !== 'APPROVED') {
      return { ok: false as const, error: 'Invalid transition: APPROVED decision must set version to APPROVED' };
    }
    if (input.nextApprovalStatus === 'CHANGES_REQUESTED' && input.nextVersionStatus !== 'DRAFT') {
      return { ok: false as const, error: 'Invalid transition: CHANGES_REQUESTED decision must set version to DRAFT' };
    }
    const { session } = input;
    await this.ensureSession(session);
    return await this.withTenantTransaction(session.tenantId, async (client) => {
      const approvalResult = await client.query<ApprovalRow>(
        `
          SELECT id, tenant_id, package_id, version_id, requested_by, requested_at, scope, risk, status, decided_by, decided_at, notes
          FROM approvals_reviews
          WHERE tenant_id = $1 AND id = $2
          LIMIT 1
        `,
        [session.tenantId, input.approvalId],
      );
      const approval = approvalResult.rows[0];
      if (!approval) return { ok: false as const, error: 'Approval not found' };
      if (approval.status !== 'PENDING') {
        return {
          ok: false as const,
          error: `Approval is in status ${approval.status}. Only PENDING approvals can be decided.`,
        };
      }

      const version = await this.loadVersionOrNull(client, session.tenantId, approval.version_id);
      if (!version) return { ok: false as const, error: 'Version not found for approval' };
      if (version.status !== 'REVIEW') {
        return {
          ok: false as const,
          error: `Version is in status ${version.status}. Expected REVIEW for approval decisions.`,
        };
      }
      if (version.isKilled) {
        return { ok: false as const, error: 'Cannot decide approval for a killed version' };
      }

      await client.query(
        `
          UPDATE approvals_reviews
          SET status = $1::approval_status, decided_by = $2, decided_at = NOW(), notes = $3
          WHERE tenant_id = $4 AND id = $5
        `,
        [input.nextApprovalStatus, session.userName, input.notes ?? null, session.tenantId, input.approvalId],
      );
      await client.query(
        `
          UPDATE config_versions
          SET status = $1::config_version_status, updated_by = $2, updated_at = NOW()
          WHERE tenant_id = $3 AND id = $4
        `,
        [input.nextVersionStatus, session.userName, session.tenantId, approval.version_id],
      );
      await this.insertAudit(client, {
        tenantId: session.tenantId,
        actor: session.userName,
        action: input.action,
        target: `${approval.package_id}@${approval.version_id}`,
        severity: input.severity,
        metadata: {
          stage: 'review.decide',
          packageId: approval.package_id,
          versionId: approval.version_id,
          approvalId: approval.id,
          previousApprovalStatus: approval.status,
          nextApprovalStatus: input.nextApprovalStatus,
          previousVersionStatus: version.status,
          nextVersionStatus: input.nextVersionStatus,
          notes: input.notes,
        },
      });
      return { ok: true as const };
    });
  }

  private async withTenantTransaction<T>(tenantId: string, fn: (client: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertAudit(
    client: SqlClient,
    event: {
      tenantId: string;
      actor: string;
      action: string;
      target: string;
      severity: AuditSeverity;
      metadata?: JsonRecord;
    },
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO audit_events (id, tenant_id, actor, action, target, severity, metadata)
        VALUES ($1, $2, $3, $4, $5, $6::audit_severity, $7::jsonb)
      `,
      [
        prefixedId('evt'),
        event.tenantId,
        event.actor,
        event.action,
        event.target,
        event.severity,
        JSON.stringify(event.metadata ?? {}),
      ],
    );
  }
}

function requiredConnectionString(value?: string): string {
  const connection = value ?? process.env.DATABASE_URL;
  if (!connection) {
    throw new Error('DATABASE_URL is required for Postgres persistence');
  }
  return connection;
}

function prefixedId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): JsonRecord {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(value) ? (value as JsonRecord) : {};
}

function normalizeBundleUiPages(bundle: JsonRecord): JsonRecord {
  const next: JsonRecord = { ...bundle };
  const uiSchemasRaw = toRecord(next.uiSchemasById);
  const normalizedById: JsonRecord = {};

  for (const [rawKey, rawSchema] of Object.entries(uiSchemasRaw)) {
    if (!isRecord(rawSchema)) continue;
    const pageIdRaw = typeof rawSchema.pageId === 'string' ? rawSchema.pageId.trim() : '';
    const pageId = pageIdRaw || rawKey;
    normalizedById[pageId] = {
      ...rawSchema,
      pageId,
    };
  }

  if (Object.keys(normalizedById).length === 0) {
    const legacyUiSchema = toRecord(next.uiSchema);
    if (Object.keys(legacyUiSchema).length > 0) {
      const pageIdRaw = typeof legacyUiSchema.pageId === 'string' ? legacyUiSchema.pageId.trim() : '';
      const pageId = pageIdRaw || 'builder-preview';
      normalizedById[pageId] = {
        ...legacyUiSchema,
        pageId,
      };
    }
  }

  const pageIds = Object.keys(normalizedById);
  if (pageIds.length === 0) return next;

  const activeRaw = typeof next.activeUiPageId === 'string' ? next.activeUiPageId.trim() : '';
  const active = activeRaw && normalizedById[activeRaw] ? activeRaw : pageIds[0]!;

  next.uiSchemasById = normalizedById;
  next.activeUiPageId = active;
  next.uiSchema = toRecord(normalizedById[active]);

  return next;
}

function mapPackage(row: PackageRow): RepoConfigPackage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    configId: row.config_id,
    name: row.name,
    description: row.description ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapVersion(row: VersionRow): RepoConfigVersion {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    packageId: row.package_id,
    version: row.version,
    status: row.status,
    bundle: normalizeBundleUiPages(toRecord(row.bundle)),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    isKilled: row.is_killed,
    killReason: row.kill_reason ?? undefined,
  };
}

function mapApproval(row: ApprovalRow): RepoApproval {
  const risk = row.risk === 'Low' || row.risk === 'Medium' || row.risk === 'High' ? row.risk : 'Low';
  return {
    id: row.id,
    tenantId: row.tenant_id,
    packageId: row.package_id,
    versionId: row.version_id,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    scope: row.scope,
    risk,
    status: row.status,
    decidedBy: row.decided_by ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function mapAuditEvent(row: AuditRow): RepoAuditEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actor: row.actor,
    action: row.action,
    target: row.target,
    severity: row.severity,
    metadata: toRecord(row.metadata),
    at: row.at,
  };
}

function mapFeatureFlag(row: FeatureFlagRow): RepoFeatureFlag {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    env: row.env,
    key: row.flag_key,
    enabled: row.enabled,
    value: toRecord(row.value),
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at,
  };
}

function mapKillSwitch(row: KillSwitchRow): RepoKillSwitch {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    scope: row.scope,
    packageId: row.package_id ?? undefined,
    versionId: row.version_id ?? undefined,
    rulesetKey: row.ruleset_key ?? undefined,
    active: row.active,
    reason: row.reason ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at,
  };
}

function mapBranding(row: BrandingRow): RepoBranding {
  const mode = row.mode === 'dark' || row.mode === 'system' ? row.mode : 'light';
  const scale = typeof row.typography_scale === 'number' ? row.typography_scale : Number(row.typography_scale);
  return {
    tenantId: row.tenant_id,
    logoUrl: row.logo_url ?? undefined,
    mode,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    typographyScale: Number.isFinite(scale) ? scale : 1,
    radius: row.radius,
    spacing: row.spacing,
    cssVariables: toRecord(row.css_variables),
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at,
  };
}

function mapTrace(row: TraceRow): RepoExecutionTrace {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    executionId: row.execution_id,
    correlationId: row.correlation_id,
    packageId: row.package_id ?? undefined,
    versionId: row.version_id ?? undefined,
    trace: toRecord(row.trace),
    coldStorageUri: row.cold_storage_uri ?? undefined,
    createdAt: row.created_at,
  };
}
