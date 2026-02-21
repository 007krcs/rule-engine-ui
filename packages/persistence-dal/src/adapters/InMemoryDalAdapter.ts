import { assertLifecycleTransition } from '../lifecycle';
import { assertTenantAccess, createVersionId, deepClone, nowIso } from '../helpers';
import type {
  DalConfigRecord,
  DalVersionRecord,
  PersistenceDal,
  SaveConfigInput,
  TenantContext,
  TransitionVersionInput,
} from '../types';

type TenantStore = Map<string, DalConfigRecord>;

export class InMemoryDalAdapter implements PersistenceDal {
  private readonly store = new Map<string, TenantStore>();

  async getConfig(context: TenantContext, configId: string): Promise<DalConfigRecord | null> {
    const tenant = this.store.get(context.tenantId);
    if (!tenant) return null;
    const record = tenant.get(configId);
    return record ? deepClone(record) : null;
  }

  async saveConfig(context: TenantContext, input: SaveConfigInput): Promise<DalConfigRecord> {
    const tenant = this.getTenantStore(context.tenantId);
    const existing = tenant.get(input.configId);
    const ts = nowIso();
    if (!existing) {
      const created: DalConfigRecord = {
        configId: input.configId,
        tenantId: context.tenantId,
        name: input.name,
        description: input.description,
        createdAt: ts,
        updatedAt: ts,
        versions: [
          {
            versionId: input.versionId ?? createVersionId(),
            label: input.versionLabel ?? '0.1.0',
            status: 'Draft',
            bundle: deepClone(input.bundle),
            createdAt: ts,
            updatedAt: ts,
          },
        ],
      };
      tenant.set(created.configId, created);
      return deepClone(created);
    }

    assertTenantAccess(context, existing.tenantId);
    const nextVersion: DalVersionRecord = {
      versionId: input.versionId ?? createVersionId(),
      label: input.versionLabel ?? nextVersionLabel(existing.versions[0]?.label),
      status: 'Draft',
      bundle: deepClone(input.bundle),
      createdAt: ts,
      updatedAt: ts,
    };
    const updated: DalConfigRecord = {
      ...existing,
      name: input.name || existing.name,
      description: input.description ?? existing.description,
      updatedAt: ts,
      versions: [nextVersion, ...existing.versions],
    };
    tenant.set(updated.configId, updated);
    return deepClone(updated);
  }

  async listConfigs(context: TenantContext): Promise<DalConfigRecord[]> {
    const tenant = this.store.get(context.tenantId);
    if (!tenant) return [];
    return Array.from(tenant.values()).map((record) => deepClone(record));
  }

  async listVersions(context: TenantContext, configId: string): Promise<DalVersionRecord[]> {
    const config = await this.getConfig(context, configId);
    if (!config) return [];
    return deepClone(config.versions);
  }

  async transitionVersion(context: TenantContext, input: TransitionVersionInput): Promise<DalVersionRecord> {
    const tenant = this.getTenantStore(context.tenantId);
    const config = tenant.get(input.configId);
    if (!config) {
      throw new Error(`Config not found: ${input.configId}`);
    }
    assertTenantAccess(context, config.tenantId);
    const idx = config.versions.findIndex((version) => version.versionId === input.versionId);
    if (idx < 0) {
      throw new Error(`Version not found: ${input.versionId}`);
    }

    const current = config.versions[idx]!;
    assertLifecycleTransition(current.status, input.toStatus);
    const nextVersion: DalVersionRecord = { ...current, status: input.toStatus, updatedAt: nowIso() };
    const nextVersions = [...config.versions];
    nextVersions[idx] = nextVersion;
    tenant.set(config.configId, { ...config, versions: nextVersions, updatedAt: nextVersion.updatedAt });
    return deepClone(nextVersion);
  }

  private getTenantStore(tenantId: string): TenantStore {
    const existing = this.store.get(tenantId);
    if (existing) return existing;
    const created: TenantStore = new Map();
    this.store.set(tenantId, created);
    return created;
  }
}

function nextVersionLabel(previous?: string): string {
  if (!previous) return '0.1.0';
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(previous);
  if (!match) return `${previous}-next`;
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}
