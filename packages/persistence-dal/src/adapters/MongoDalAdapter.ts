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

type MongoCollectionLike = {
  findOne(filter: Record<string, unknown>): Promise<DalConfigRecord | null>;
  find(filter: Record<string, unknown>): { toArray(): Promise<DalConfigRecord[]> };
  insertOne(doc: DalConfigRecord): Promise<void>;
  replaceOne(filter: Record<string, unknown>, replacement: DalConfigRecord, options?: Record<string, unknown>): Promise<void>;
};

export class MongoDalAdapter implements PersistenceDal {
  private readonly collectionName: string;
  private readonly dbName: string;
  private readonly uri: string;
  private collectionPromise: Promise<MongoCollectionLike> | null = null;

  constructor(options: { uri: string; dbName?: string; collectionName?: string }) {
    this.uri = options.uri;
    this.dbName = options.dbName ?? 'ruleflow';
    this.collectionName = options.collectionName ?? 'configs';
  }

  async getConfig(context: TenantContext, configId: string): Promise<DalConfigRecord | null> {
    const collection = await this.getCollection();
    const found = await this.instrumentCollectionCall(context, 'mongo.find_one', () =>
      collection.findOne({ tenantId: context.tenantId, configId }),
    );
    if (!found) return null;
    assertTenantAccess(context, found.tenantId);
    return deepClone(found);
  }

  async saveConfig(context: TenantContext, input: SaveConfigInput): Promise<DalConfigRecord> {
    const collection = await this.getCollection();
    const existing = await this.instrumentCollectionCall(context, 'mongo.find_one', () =>
      collection.findOne({ tenantId: context.tenantId, configId: input.configId }),
    );
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
      await this.instrumentCollectionCall(context, 'mongo.insert_one', () => collection.insertOne(created));
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
      versions: [nextVersion, ...existing.versions],
      updatedAt: ts,
    };
    await this.instrumentCollectionCall(context, 'mongo.replace_one', () =>
      collection.replaceOne(
        { tenantId: context.tenantId, configId: input.configId },
        updated,
        { upsert: true },
      ),
    );
    return deepClone(updated);
  }

  async listConfigs(context: TenantContext): Promise<DalConfigRecord[]> {
    const collection = await this.getCollection();
    const rows = await this.instrumentCollectionCall(context, 'mongo.find', () =>
      collection.find({ tenantId: context.tenantId }).toArray(),
    );
    return rows.map((row) => deepClone(row));
  }

  async listVersions(context: TenantContext, configId: string): Promise<DalVersionRecord[]> {
    const config = await this.getConfig(context, configId);
    if (!config) return [];
    return deepClone(config.versions);
  }

  async transitionVersion(context: TenantContext, input: TransitionVersionInput): Promise<DalVersionRecord> {
    const collection = await this.getCollection();
    const config = await this.instrumentCollectionCall(context, 'mongo.find_one', () =>
      collection.findOne({ tenantId: context.tenantId, configId: input.configId }),
    );
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
    const nextVersion: DalVersionRecord = {
      ...current,
      status: input.toStatus,
      updatedAt: nowIso(),
    };
    const nextVersions = [...config.versions];
    nextVersions[idx] = nextVersion;
    const nextConfig: DalConfigRecord = {
      ...config,
      versions: nextVersions,
      updatedAt: nextVersion.updatedAt,
    };
    await this.instrumentCollectionCall(context, 'mongo.replace_one', () =>
      collection.replaceOne(
        { tenantId: context.tenantId, configId: input.configId },
        nextConfig,
        { upsert: true },
      ),
    );
    return deepClone(nextVersion);
  }

  async close(): Promise<void> {
    const collection = await this.getCollection();
    const maybe = collection as unknown as { client?: { close?: () => Promise<void> } };
    if (maybe.client?.close) {
      await maybe.client.close();
    }
  }

  private async getCollection(): Promise<MongoCollectionLike> {
    if (!this.collectionPromise) {
      this.collectionPromise = this.createCollection();
    }
    return await this.collectionPromise;
  }

  private async instrumentCollectionCall<T>(
    context: TenantContext,
    callName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return await withExternalCallInstrumentation({
      name: callName,
      module: 'persistence-dal',
      tenantId: context.tenantId,
      attributes: { backend: 'mongodb', db: this.dbName, collection: this.collectionName },
      fn,
    });
  }

  private async createCollection(): Promise<MongoCollectionLike> {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<unknown>;
    const mod = (await dynamicImport('mongodb')) as {
      MongoClient: new (uri: string) => {
        connect(): Promise<void>;
        db(name: string): {
          collection(name: string): MongoCollectionLike;
        };
      };
    };
    const client = new mod.MongoClient(this.uri);
    await client.connect();
    const collection = client.db(this.dbName).collection(this.collectionName);
    const wrapped = collection as MongoCollectionLike & { client?: typeof client };
    wrapped.client = client;
    return wrapped;
  }
}

function nextVersionLabel(previous?: string): string {
  if (!previous) return '0.1.0';
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(previous);
  if (!match) return `${previous}-next`;
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}
