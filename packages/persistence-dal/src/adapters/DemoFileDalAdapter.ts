import { promises as fs } from 'node:fs';
import path from 'node:path';
import { assertLifecycleTransition } from '../lifecycle';
import { assertTenantAccess, createVersionId, deepClone, nowIso } from '../helpers';
import { withExternalCallInstrumentation } from '@platform/observability';
import type {
  DalConfigRecord,
  DalVersionRecord,
  PersistenceDal,
  SaveConfigInput,
  TenantContext,
  TransitionVersionInput,
} from '../types';

type PersistedModel = {
  tenants: Record<string, Record<string, DalConfigRecord>>;
};

const LOCK_NAME = '.configs.lock';

export class DemoFileDalAdapter implements PersistenceDal {
  private readonly baseDir: string;
  private readonly stateFile: string;
  private readonly lockFile: string;

  constructor(baseDir: string, filename = 'dal-configs.json') {
    this.baseDir = baseDir;
    this.stateFile = path.join(baseDir, filename);
    this.lockFile = path.join(baseDir, LOCK_NAME);
  }

  async getConfig(context: TenantContext, configId: string): Promise<DalConfigRecord | null> {
    const state = await this.readState(context.tenantId);
    const tenant = state.tenants[context.tenantId];
    const config = tenant?.[configId];
    return config ? deepClone(config) : null;
  }

  async saveConfig(context: TenantContext, input: SaveConfigInput): Promise<DalConfigRecord> {
    return await this.withLocked(async () => {
      const state = await this.readState(context.tenantId);
      const tenant = state.tenants[context.tenantId] ?? {};
      const current = tenant[input.configId];
      const ts = nowIso();
      if (!current) {
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
        state.tenants[context.tenantId] = { ...tenant, [input.configId]: created };
        await this.writeState(context.tenantId, state);
        return deepClone(created);
      }

      assertTenantAccess(context, current.tenantId);
      const nextVersion: DalVersionRecord = {
        versionId: input.versionId ?? createVersionId(),
        label: input.versionLabel ?? nextVersionLabel(current.versions[0]?.label),
        status: 'Draft',
        bundle: deepClone(input.bundle),
        createdAt: ts,
        updatedAt: ts,
      };
      const updated: DalConfigRecord = {
        ...current,
        name: input.name || current.name,
        description: input.description ?? current.description,
        updatedAt: ts,
        versions: [nextVersion, ...current.versions],
      };
      state.tenants[context.tenantId] = { ...tenant, [input.configId]: updated };
      await this.writeState(context.tenantId, state);
      return deepClone(updated);
    }, context.tenantId);
  }

  async listConfigs(context: TenantContext): Promise<DalConfigRecord[]> {
    const state = await this.readState(context.tenantId);
    const tenant = state.tenants[context.tenantId];
    if (!tenant) return [];
    return Object.values(tenant).map((record) => deepClone(record));
  }

  async listVersions(context: TenantContext, configId: string): Promise<DalVersionRecord[]> {
    const config = await this.getConfig(context, configId);
    if (!config) return [];
    return deepClone(config.versions);
  }

  async transitionVersion(context: TenantContext, input: TransitionVersionInput): Promise<DalVersionRecord> {
    return await this.withLocked(async () => {
      const state = await this.readState(context.tenantId);
      const tenant = state.tenants[context.tenantId] ?? {};
      const config = tenant[input.configId];
      if (!config) {
        throw new Error(`Config not found: ${input.configId}`);
      }
      assertTenantAccess(context, config.tenantId);
      const versionIndex = config.versions.findIndex((version) => version.versionId === input.versionId);
      if (versionIndex < 0) {
        throw new Error(`Version not found: ${input.versionId}`);
      }

      const current = config.versions[versionIndex]!;
      assertLifecycleTransition(current.status, input.toStatus);
      const nextVersion: DalVersionRecord = {
        ...current,
        status: input.toStatus,
        updatedAt: nowIso(),
      };
      const nextVersions = [...config.versions];
      nextVersions[versionIndex] = nextVersion;
      state.tenants[context.tenantId] = {
        ...tenant,
        [config.configId]: {
          ...config,
          versions: nextVersions,
          updatedAt: nextVersion.updatedAt,
        },
      };
      await this.writeState(context.tenantId, state);
      return deepClone(nextVersion);
    }, context.tenantId);
  }

  private async withLocked<T>(fn: () => Promise<T>, tenantId: string): Promise<T> {
    await this.acquireLock(tenantId);
    try {
      return await fn();
    } finally {
      await this.releaseLock(tenantId);
    }
  }

  private async acquireLock(tenantId: string): Promise<void> {
    await this.instrumentFsCall(tenantId, 'demo_file.mkdir', () => fs.mkdir(this.baseDir, { recursive: true }));
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const handle = await this.instrumentFsCall(tenantId, 'demo_file.lock_open', () =>
          fs.open(this.lockFile, 'wx'),
        );
        await this.instrumentFsCall(tenantId, 'demo_file.lock_close', () => handle.close());
        return;
      } catch (error) {
        if (!isErrno(error, 'EEXIST')) {
          throw error;
        }
        await sleep(25 + attempt * 5);
      }
    }
    throw new Error(`Timed out acquiring demo store lock: ${this.lockFile}`);
  }

  private async releaseLock(tenantId: string): Promise<void> {
    await this.instrumentFsCall(tenantId, 'demo_file.unlock', () =>
      fs.unlink(this.lockFile).catch(() => undefined),
    );
  }

  private async readState(tenantId: string): Promise<PersistedModel> {
    await this.instrumentFsCall(tenantId, 'demo_file.mkdir', () => fs.mkdir(this.baseDir, { recursive: true }));
    try {
      const raw = await this.instrumentFsCall(tenantId, 'demo_file.read_file', () =>
        fs.readFile(this.stateFile, 'utf8'),
      );
      return safeParse(raw);
    } catch (error) {
      if (isErrno(error, 'ENOENT')) {
        return { tenants: {} };
      }
      throw error;
    }
  }

  private async writeState(tenantId: string, state: PersistedModel): Promise<void> {
    await this.instrumentFsCall(tenantId, 'demo_file.mkdir', () => fs.mkdir(this.baseDir, { recursive: true }));
    await this.instrumentFsCall(tenantId, 'demo_file.write_file', () =>
      fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), 'utf8'),
    );
  }

  private async instrumentFsCall<T>(
    tenantId: string,
    callName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return await withExternalCallInstrumentation({
      name: callName,
      module: 'persistence-dal',
      tenantId,
      attributes: { backend: 'demo-file', path: this.stateFile },
      fn,
    });
  }
}

function safeParse(raw: string): PersistedModel {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return { tenants: {} };
    }
    const tenants = (parsed as { tenants?: unknown }).tenants;
    if (!tenants || typeof tenants !== 'object' || Array.isArray(tenants)) {
      return { tenants: {} };
    }
    return { tenants: tenants as PersistedModel['tenants'] };
  } catch {
    return { tenants: {} };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && (error as { code?: string }).code === code;
}

function nextVersionLabel(previous?: string): string {
  if (!previous) return '0.1.0';
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(previous);
  if (!match) return `${previous}-next`;
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}
