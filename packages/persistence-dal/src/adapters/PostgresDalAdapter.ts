import { assertLifecycleTransition } from '../lifecycle';
import { assertTenantAccess, createVersionId, deepClone } from '../helpers';
import { withExternalCallInstrumentation } from '@platform/observability';
import type {
  DalConfigRecord,
  DalVersionRecord,
  PersistenceDal,
  SaveConfigInput,
  TenantContext,
  TransitionVersionInput,
} from '../types';

type PgStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ACTIVE' | 'DEPRECATED' | 'RETIRED';
type RepoSession = {
  tenantId: string;
  userId: string;
  userName: string;
  roles: string[];
};
type PostgresTenantRepository = {
  getConsoleSnapshot(tenantId: string): Promise<{
    packages: Array<{
      id: string;
      tenantId: string;
      configId: string;
      name: string;
      description?: string;
      createdAt: string;
    }>;
    versions: Array<{
      id: string;
      packageId: string;
      version: string;
      status: PgStatus;
      bundle: Record<string, unknown>;
      createdAt: string;
      updatedAt?: string;
    }>;
    approvals: Array<{
      id: string;
      versionId: string;
      status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
    }>;
  }>;
  createConfigPackage(input: {
    session: RepoSession;
    packageId: string;
    configId: string;
    name: string;
    description?: string;
    versionId: string;
    versionLabel: string;
    bundle: Record<string, unknown>;
  }): Promise<unknown>;
  createConfigVersion(input: {
    session: RepoSession;
    packageId: string;
    versionId: string;
    versionLabel: string;
    bundle: Record<string, unknown>;
  }): Promise<unknown>;
  submitForReview(input: {
    session: RepoSession;
    versionId: string;
    scope: string;
    risk: 'Low' | 'Medium' | 'High';
  }): Promise<{ ok: true; approvalId: string } | { ok: false; error: string }>;
  approveReview(input: {
    session: RepoSession;
    approvalId: string;
  }): Promise<{ ok: true } | { ok: false; error: string }>;
  exportTenantBundle(input: { tenantId: string }): Promise<{
    packages: Array<Record<string, unknown>>;
    versions: Array<{
      id: string;
      status: PgStatus;
      [key: string]: unknown;
    }>;
    approvals: Array<Record<string, unknown>>;
    audit: Array<Record<string, unknown>>;
    featureFlags: Array<Record<string, unknown>>;
    killSwitches: Array<Record<string, unknown>>;
    branding?: Record<string, unknown> | null;
  }>;
  importTenantBundle(input: {
    session: RepoSession;
    payload: {
      packages: Array<Record<string, unknown>>;
      versions: Array<Record<string, unknown>>;
      approvals: Array<Record<string, unknown>>;
      audit: Array<Record<string, unknown>>;
      featureFlags: Array<Record<string, unknown>>;
      killSwitches: Array<Record<string, unknown>>;
      branding?: Record<string, unknown> | null;
    };
  }): Promise<{ ok: true }>;
};

export class PostgresDalAdapter implements PersistenceDal {
  private readonly repo: PostgresTenantRepository;
  private readonly risk: 'Low' | 'Medium' | 'High';
  private readonly reviewScope: string;

  constructor(
    repo: PostgresTenantRepository,
    options?: { defaultRisk?: 'Low' | 'Medium' | 'High'; defaultReviewScope?: string },
  ) {
    this.repo = repo;
    this.risk = options?.defaultRisk ?? 'Medium';
    this.reviewScope = options?.defaultReviewScope ?? 'Tenant review';
  }

  async getConfig(context: TenantContext, configId: string): Promise<DalConfigRecord | null> {
    const snapshot = await this.instrumentRepoCall(context, 'postgres.get_console_snapshot', () =>
      this.repo.getConsoleSnapshot(context.tenantId),
    );
    const pkg = snapshot.packages.find((entry) => entry.configId === configId || entry.id === configId);
    if (!pkg) return null;
    assertTenantAccess(context, pkg.tenantId);
    return {
      configId: pkg.configId,
      tenantId: pkg.tenantId,
      name: pkg.name,
      description: pkg.description,
      createdAt: pkg.createdAt,
      updatedAt: snapshot.versions.find((version) => version.packageId === pkg.id)?.updatedAt ?? pkg.createdAt,
      versions: snapshot.versions
        .filter((version) => version.packageId === pkg.id)
        .map((version) => mapDalVersion(version)),
    };
  }

  async saveConfig(context: TenantContext, input: SaveConfigInput): Promise<DalConfigRecord> {
    const session = toSession(context);
    const existing = await this.getConfig(context, input.configId);
    if (!existing) {
      const packageId = input.configId;
      await this.instrumentRepoCall(context, 'postgres.create_config_package', () =>
        this.repo.createConfigPackage({
          session,
          packageId,
          configId: input.configId,
          name: input.name,
          description: input.description,
          versionId: input.versionId ?? createVersionId(),
          versionLabel: input.versionLabel ?? '0.1.0',
          bundle: deepClone(input.bundle),
        }),
      );
      const created = await this.getConfig(context, input.configId);
      if (!created) {
        throw new Error(`Config not found after create: ${input.configId}`);
      }
      return created;
    }

    await this.instrumentRepoCall(context, 'postgres.create_config_version', () =>
      this.repo.createConfigVersion({
        session,
        packageId: existing.configId,
        versionId: input.versionId ?? createVersionId(),
        versionLabel: input.versionLabel ?? nextVersionLabel(existing.versions[0]?.label),
        bundle: deepClone(input.bundle),
      }),
    );
    const updated = await this.getConfig(context, input.configId);
    if (!updated) {
      throw new Error(`Config not found after save: ${input.configId}`);
    }
    return updated;
  }

  async listConfigs(context: TenantContext): Promise<DalConfigRecord[]> {
    const snapshot = await this.instrumentRepoCall(context, 'postgres.get_console_snapshot', () =>
      this.repo.getConsoleSnapshot(context.tenantId),
    );
    return snapshot.packages.map((pkg) => ({
      configId: pkg.configId,
      tenantId: pkg.tenantId,
      name: pkg.name,
      description: pkg.description,
      createdAt: pkg.createdAt,
      updatedAt: snapshot.versions.find((version) => version.packageId === pkg.id)?.updatedAt ?? pkg.createdAt,
      versions: snapshot.versions.filter((version) => version.packageId === pkg.id).map((version) => mapDalVersion(version)),
    }));
  }

  async listVersions(context: TenantContext, configId: string): Promise<DalVersionRecord[]> {
    const config = await this.getConfig(context, configId);
    return config ? config.versions : [];
  }

  async transitionVersion(context: TenantContext, input: TransitionVersionInput): Promise<DalVersionRecord> {
    const config = await this.getConfig(context, input.configId);
    if (!config) {
      throw new Error(`Config not found: ${input.configId}`);
    }
    const current = config.versions.find((version) => version.versionId === input.versionId);
    if (!current) {
      throw new Error(`Version not found: ${input.versionId}`);
    }
    assertLifecycleTransition(current.status, input.toStatus);
    const session = toSession(context);

    if (current.status === 'Draft' && input.toStatus === 'Submitted') {
      const result = await this.instrumentRepoCall(context, 'postgres.submit_for_review', () =>
        this.repo.submitForReview({
          session,
          versionId: current.versionId,
          scope: this.reviewScope,
          risk: this.risk,
        }),
      );
      if (!result.ok) {
        throw new Error(result.error);
      }
    } else if (current.status === 'Submitted' && input.toStatus === 'Approved') {
      const snapshot = await this.instrumentRepoCall(context, 'postgres.get_console_snapshot', () =>
        this.repo.getConsoleSnapshot(context.tenantId),
      );
      const approval = snapshot.approvals.find(
        (row) => row.versionId === input.versionId && row.status === 'PENDING',
      );
      if (!approval) {
        throw new Error(`Pending approval not found for version ${input.versionId}`);
      }
      const result = await this.instrumentRepoCall(context, 'postgres.approve_review', () =>
        this.repo.approveReview({ session, approvalId: approval.id }),
      );
      if (!result.ok) {
        throw new Error(result.error);
      }
    } else {
      await this.patchVersionStatusViaImport(context, input.versionId, input.toStatus);
    }

    const refreshed = await this.listVersions(context, input.configId);
    const next = refreshed.find((version) => version.versionId === input.versionId);
    if (!next) {
      throw new Error(`Version not found after transition: ${input.versionId}`);
    }
    return next;
  }

  private async patchVersionStatusViaImport(
    context: TenantContext,
    versionId: string,
    nextStatus: DalVersionRecord['status'],
  ): Promise<void> {
    const payload = await this.instrumentRepoCall(context, 'postgres.export_tenant_bundle', () =>
      this.repo.exportTenantBundle({ tenantId: context.tenantId }),
    );
    const nextVersions = payload.versions.map((version) => {
      if (version.id !== versionId) return version;
      return {
        ...version,
        status: toPgStatus(nextStatus),
      };
    });
    const patched = { ...payload, versions: nextVersions };
    await this.instrumentRepoCall(context, 'postgres.import_tenant_bundle', () =>
      this.repo.importTenantBundle({
        session: toSession(context),
        payload: patched,
      }),
    );
  }

  private async instrumentRepoCall<T>(
    context: TenantContext,
    callName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return await withExternalCallInstrumentation({
      name: callName,
      module: 'persistence-dal',
      tenantId: context.tenantId,
      attributes: { backend: 'postgres' },
      fn,
    });
  }
}

function toSession(context: TenantContext): RepoSession {
  return {
    tenantId: context.tenantId,
    userId: context.userId ?? 'dal-user',
    userName: context.userName ?? context.userId ?? 'dal-user',
    roles: context.roles ?? ['Author', 'Approver', 'Publisher'],
  };
}

function mapDalVersion(version: {
  id: string;
  version: string;
  status: PgStatus;
  bundle: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}): DalVersionRecord {
  return {
    versionId: version.id,
    label: version.version,
    status: fromPgStatus(version.status),
    bundle: deepClone(version.bundle),
    createdAt: version.createdAt,
    updatedAt: version.updatedAt ?? version.createdAt,
  };
}

function fromPgStatus(status: PgStatus): DalVersionRecord['status'] {
  if (status === 'DRAFT') return 'Draft';
  if (status === 'REVIEW') return 'Submitted';
  if (status === 'APPROVED' || status === 'ACTIVE') return 'Approved';
  if (status === 'DEPRECATED') return 'Deprecated';
  return 'Deleted';
}

function toPgStatus(status: DalVersionRecord['status']): PgStatus {
  if (status === 'Draft') return 'DRAFT';
  if (status === 'Submitted') return 'REVIEW';
  if (status === 'Approved') return 'APPROVED';
  if (status === 'Deprecated') return 'DEPRECATED';
  return 'RETIRED';
}

function nextVersionLabel(previous?: string): string {
  if (!previous) return '0.1.0';
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(previous);
  if (!match) return `${previous}-next`;
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}
