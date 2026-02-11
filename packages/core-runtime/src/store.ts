import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE_STORE_DIR = '.ruleflow-demo-data';
const DEFAULT_TMP_STORE_DIR = '/tmp/.ruleflow-demo-data';
const DEFAULT_STORE_FILENAME = 'configs.json';
const STORE_WRITE_FAILED_MESSAGE = 'Store write failed';

export type ConfigStoreProvider = 'file' | 'tmp';

export type ConfigVersion = {
  id: string;
  schema: unknown;
  createdAt: string;
  approved: boolean;
  approvedAt?: string;
};

export type ConfigRecord = {
  id: string;
  schema: unknown;
  createdAt: string;
  updatedAt: string;
  versions: ConfigVersion[];
};

export type CreateConfigInput = {
  id: string;
  schema: unknown;
};

export type AddVersionInput = {
  id: string;
  schema: unknown;
};

export interface ConfigStore {
  readonly provider: ConfigStoreProvider;
  readonly baseDir: string;
  createConfig(input: CreateConfigInput): Promise<ConfigRecord>;
  getConfig(configId: string): Promise<ConfigRecord | null>;
  updateSchema(configId: string, schema: unknown): Promise<ConfigRecord>;
  addVersion(configId: string, input: AddVersionInput): Promise<ConfigRecord>;
  approveVersion(configId: string, versionId: string): Promise<ConfigRecord>;
  listConfigs(): Promise<ConfigRecord[]>;
}

export type ConfigStoreFactoryOptions = {
  fileDir?: string;
  tmpDir?: string;
  vercel?: string;
  storeFilename?: string;
};

type StoreFile = {
  configs: ConfigRecord[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function toStoreWriteError(cause: unknown): Error {
  const error = new Error(STORE_WRITE_FAILED_MESSAGE);
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStoreFile(raw: unknown): StoreFile {
  if (!isRecord(raw)) return { configs: [] };
  const configsRaw = raw.configs;
  if (!Array.isArray(configsRaw)) return { configs: [] };

  const configs: ConfigRecord[] = [];
  for (const item of configsRaw) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== 'string' || item.id.trim().length === 0) continue;
    const createdAt = typeof item.createdAt === 'string' ? item.createdAt : nowIso();
    const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt : createdAt;
    const versionsRaw = Array.isArray(item.versions) ? item.versions : [];
    const versions: ConfigVersion[] = versionsRaw
      .filter(isRecord)
      .map((version) => ({
        id: typeof version.id === 'string' ? version.id : 'version',
        schema: version.schema ?? null,
        createdAt: typeof version.createdAt === 'string' ? version.createdAt : nowIso(),
        approved: version.approved === true,
        approvedAt: typeof version.approvedAt === 'string' ? version.approvedAt : undefined,
      }));

    configs.push({
      id: item.id,
      schema: item.schema ?? null,
      createdAt,
      updatedAt,
      versions,
    });
  }

  return { configs };
}

abstract class BaseFsConfigStore implements ConfigStore {
  readonly provider: ConfigStoreProvider;
  readonly baseDir: string;

  private readonly storeFile: string;
  private writeQueue: Promise<void> = Promise.resolve();

  protected constructor(provider: ConfigStoreProvider, baseDir: string, filename: string) {
    this.provider = provider;
    this.baseDir = baseDir;
    this.storeFile = path.join(baseDir, filename);
  }

  async createConfig(input: CreateConfigInput): Promise<ConfigRecord> {
    return await this.mutate((state) => {
      if (state.configs.some((config) => config.id === input.id)) {
        throw new Error(`Config ${input.id} already exists`);
      }
      const createdAt = nowIso();
      const created: ConfigRecord = {
        id: input.id,
        schema: deepClone(input.schema),
        createdAt,
        updatedAt: createdAt,
        versions: [],
      };
      return {
        next: { configs: [created, ...state.configs] },
        result: deepClone(created),
      };
    });
  }

  async getConfig(configId: string): Promise<ConfigRecord | null> {
    const state = await this.readStore();
    const config = state.configs.find((item) => item.id === configId);
    return config ? deepClone(config) : null;
  }

  async updateSchema(configId: string, schema: unknown): Promise<ConfigRecord> {
    return await this.mutate((state) => {
      let updated: ConfigRecord | null = null;
      const nextConfigs = state.configs.map((item) => {
        if (item.id !== configId) return item;
        updated = {
          ...item,
          schema: deepClone(schema),
          updatedAt: nowIso(),
        };
        return updated;
      });

      if (!updated) {
        throw new Error(`Config ${configId} not found`);
      }

      return {
        next: { configs: nextConfigs },
        result: deepClone(updated),
      };
    });
  }

  async addVersion(configId: string, input: AddVersionInput): Promise<ConfigRecord> {
    return await this.mutate((state) => {
      let updated: ConfigRecord | null = null;
      const nextConfigs = state.configs.map((item) => {
        if (item.id !== configId) return item;
        const version: ConfigVersion = {
          id: input.id,
          schema: deepClone(input.schema),
          createdAt: nowIso(),
          approved: false,
        };
        updated = {
          ...item,
          versions: [version, ...item.versions],
          updatedAt: nowIso(),
        };
        return updated;
      });

      if (!updated) {
        throw new Error(`Config ${configId} not found`);
      }

      return {
        next: { configs: nextConfigs },
        result: deepClone(updated),
      };
    });
  }

  async approveVersion(configId: string, versionId: string): Promise<ConfigRecord> {
    return await this.mutate((state) => {
      let updated: ConfigRecord | null = null;
      const nextConfigs = state.configs.map((item) => {
        if (item.id !== configId) return item;
        let hasVersion = false;
        const nextVersions = item.versions.map((version) => {
          if (version.id !== versionId) return version;
          hasVersion = true;
          return {
            ...version,
            approved: true,
            approvedAt: nowIso(),
          };
        });
        if (!hasVersion) {
          throw new Error(`Version ${versionId} not found for config ${configId}`);
        }
        updated = {
          ...item,
          versions: nextVersions,
          updatedAt: nowIso(),
        };
        return updated;
      });

      if (!updated) {
        throw new Error(`Config ${configId} not found`);
      }

      return {
        next: { configs: nextConfigs },
        result: deepClone(updated),
      };
    });
  }

  async listConfigs(): Promise<ConfigRecord[]> {
    const state = await this.readStore();
    return deepClone(state.configs);
  }

  private async mutate<T>(fn: (state: StoreFile) => { next: StoreFile; result: T }): Promise<T> {
    let result: T | undefined;
    this.writeQueue = this.writeQueue.then(async () => {
      const state = await this.readStore();
      const mutation = fn(state);
      await this.writeStore(mutation.next);
      result = mutation.result;
    });
    await this.writeQueue;

    if (result === undefined) {
      throw new Error('Unexpected store mutation result');
    }
    return result;
  }

  private async readStore(): Promise<StoreFile> {
    try {
      const raw = await fs.readFile(this.storeFile, 'utf8');
      return normalizeStoreFile(JSON.parse(raw) as unknown);
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
        return { configs: [] };
      }
      throw error;
    }
  }

  private async writeStore(next: StoreFile): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.storeFile), { recursive: true });
      await fs.writeFile(this.storeFile, JSON.stringify(next, null, 2), 'utf8');
    } catch (error) {
      throw toStoreWriteError(error);
    }
  }
}

export class FileConfigStore extends BaseFsConfigStore {
  constructor(options?: { baseDir?: string; storeFilename?: string }) {
    super(
      'file',
      options?.baseDir ?? path.join(process.cwd(), DEFAULT_FILE_STORE_DIR),
      options?.storeFilename ?? DEFAULT_STORE_FILENAME,
    );
  }
}

export class TmpConfigStore extends BaseFsConfigStore {
  constructor(options?: { baseDir?: string; storeFilename?: string }) {
    super('tmp', options?.baseDir ?? DEFAULT_TMP_STORE_DIR, options?.storeFilename ?? DEFAULT_STORE_FILENAME);
  }
}

export function createConfigStore(options: ConfigStoreFactoryOptions = {}): ConfigStore {
  const vercel = options.vercel ?? process.env.VERCEL;
  if (vercel === '1') {
    return new TmpConfigStore({
      baseDir: options.tmpDir,
      storeFilename: options.storeFilename,
    });
  }
  return new FileConfigStore({
    baseDir: options.fileDir,
    storeFilename: options.storeFilename,
  });
}

export function isStoreWriteError(error: unknown): boolean {
  return error instanceof Error && error.message === STORE_WRITE_FAILED_MESSAGE;
}

export { STORE_WRITE_FAILED_MESSAGE };
