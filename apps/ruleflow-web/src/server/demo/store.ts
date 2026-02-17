import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ComponentDefinition } from '@platform/component-registry';
import type { TranslationBundle } from '@platform/i18n';
import type { ApprovalRequest, AuditEvent, ConfigPackage, ConfigVersion } from '@/lib/demo/types';

export type StoreState = {
  schemaVersion: 1;
  tenantId: string;
  packages: ConfigPackage[];
  approvals: ApprovalRequest[];
  audit: AuditEvent[];
  componentRegistry: {
    schemaVersion: 1;
    global: ComponentDefinition[];
    tenants: Record<string, ComponentDefinition[]>;
  };
  translations: {
    schemaVersion: 1;
    fallbackLocale: string;
    tenantLocale?: string;
    userLocale?: string;
    bundles: TranslationBundle[];
  };
};

export type GitOpsPayload = {
  tenantId: string;
  packages: ConfigPackage[];
  approvals: ApprovalRequest[];
  audit: AuditEvent[];
  componentRegistry: StoreState['componentRegistry'];
  translations: StoreState['translations'];
};

export type ConfigStoreProvider = 'file' | 'tmp' | 'memory';

export type ConfigStoreDiagnostics = {
  provider: ConfigStoreProvider;
  baseDir: string | null;
  canWriteToStore: boolean;
  warning?: string;
};

export interface ConfigStore {
  readonly provider: ConfigStoreProvider;
  readonly baseDir: string | null;
  readonly canWriteToStore: boolean;
  readonly warning?: string;

  createPackage(pkg: ConfigPackage): Promise<void>;
  readPackage(packageId: string): Promise<ConfigPackage | null>;
  updatePackage(packageId: string, updater: (pkg: ConfigPackage) => ConfigPackage): Promise<boolean>;
  listPackages(): Promise<ConfigPackage[]>;

  createVersion(packageId: string, version: ConfigVersion): Promise<void>;
  readVersion(versionId: string): Promise<ConfigVersion | null>;
  updateVersion(versionId: string, updater: (version: ConfigVersion, packageId: string) => ConfigVersion): Promise<boolean>;
  listVersions(): Promise<ConfigVersion[]>;

  createApproval(approval: ApprovalRequest): Promise<void>;
  readApproval(approvalId: string): Promise<ApprovalRequest | null>;
  updateApproval(approvalId: string, updater: (approval: ApprovalRequest) => ApprovalRequest): Promise<boolean>;
  listApprovals(): Promise<ApprovalRequest[]>;

  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(): Promise<AuditEvent[]>;

  exportGitOpsPayload(): Promise<GitOpsPayload>;
  importGitOpsPayload(input: GitOpsPayload): Promise<void>;

  readState(): Promise<StoreState>;
  replaceState(state: StoreState): Promise<void>;
  loadSigningKey(): Promise<Buffer>;
}

export type ConfigStoreFactoryOptions = {
  seedState: () => StoreState;
  normalizeState: (raw: unknown) => StoreState;
  defaultDir?: string;
  tmpDir?: string;
  vercel?: string;
  canWriteToDirectory?: (dir: string) => Promise<boolean>;
  logger?: (line: string) => void;
};

type StoreFilePaths = {
  stateFile: string;
  signingKeyFile: string;
};

const STORE_FILENAME = 'store.json';
const SIGNING_KEY_FILENAME = 'gitops-signing-key.txt';
const DEFAULT_TMP_DIR = '/tmp/.ruleflow-demo-data';

type StoreInit = {
  seedState: () => StoreState;
  normalizeState: (raw: unknown) => StoreState;
};

export class PersistenceUnavailableError extends Error {
  readonly diagnostics: ConfigStoreDiagnostics;

  constructor(message: string, diagnostics: ConfigStoreDiagnostics, cause?: unknown) {
    super(message);
    this.name = 'PersistenceUnavailableError';
    this.diagnostics = diagnostics;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export function isPersistenceUnavailableError(error: unknown): error is PersistenceUnavailableError {
  return error instanceof PersistenceUnavailableError;
}

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toDiagnostics(store: ConfigStore): ConfigStoreDiagnostics {
  return {
    provider: store.provider,
    baseDir: store.baseDir,
    canWriteToStore: store.canWriteToStore,
    warning: store.warning,
  };
}

function isWriteError(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) return false;
  const code = (error as { code?: string }).code;
  return code === 'EACCES' || code === 'EPERM' || code === 'EROFS' || code === 'ENOSPC';
}

function defaultLogger(line: string) {
  process.stderr.write(`${line}\n`);
}

async function defaultCanWriteToDirectory(dir: string): Promise<boolean> {
  const probeName = `.ruleflow-write-probe-${crypto.randomUUID()}.tmp`;
  const probePath = path.join(dir, probeName);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(probePath, 'ok', 'utf8');
    await fs.unlink(probePath).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

abstract class BaseConfigStore implements ConfigStore {
  readonly provider: ConfigStoreProvider;
  readonly baseDir: string | null;
  readonly canWriteToStore: boolean;
  readonly warning?: string;

  private readonly init: StoreInit;
  private memory: StoreState | null;
  private signingKeyCache: Buffer | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  protected constructor(params: {
    init: StoreInit;
    provider: ConfigStoreProvider;
    baseDir: string | null;
    canWriteToStore: boolean;
    warning?: string;
    initialState?: StoreState;
  }) {
    this.init = params.init;
    this.provider = params.provider;
    this.baseDir = params.baseDir;
    this.canWriteToStore = params.canWriteToStore;
    this.warning = params.warning;
    this.memory = params.initialState ? deepCloneJson(params.initialState) : null;
  }

  protected abstract readStateFile(): Promise<unknown | null>;
  protected abstract writeStateFile(state: StoreState): Promise<void>;
  protected abstract readSigningKeyFile(): Promise<string | null>;
  protected abstract writeSigningKeyFile(encoded: string): Promise<void>;

  async createPackage(pkg: ConfigPackage): Promise<void> {
    await this.mutateState((state) => ({ ...state, packages: [pkg, ...state.packages] }));
  }

  async readPackage(packageId: string): Promise<ConfigPackage | null> {
    const state = await this.readState();
    const pkg = state.packages.find((item) => item.id === packageId);
    return pkg ? deepCloneJson(pkg) : null;
  }

  async updatePackage(packageId: string, updater: (pkg: ConfigPackage) => ConfigPackage): Promise<boolean> {
    let updated = false;
    await this.mutateState((state) => ({
      ...state,
      packages: state.packages.map((pkg) => {
        if (pkg.id !== packageId) return pkg;
        updated = true;
        return updater(pkg);
      }),
    }));
    return updated;
  }

  async listPackages(): Promise<ConfigPackage[]> {
    const state = await this.readState();
    return deepCloneJson(state.packages);
  }

  async createVersion(packageId: string, version: ConfigVersion): Promise<void> {
    await this.updatePackage(packageId, (pkg) => ({
      ...pkg,
      versions: [version, ...pkg.versions],
    }));
  }

  async readVersion(versionId: string): Promise<ConfigVersion | null> {
    const state = await this.readState();
    for (const pkg of state.packages) {
      const version = pkg.versions.find((item) => item.id === versionId);
      if (version) return deepCloneJson({ ...version, packageId: pkg.id });
    }
    return null;
  }

  async updateVersion(versionId: string, updater: (version: ConfigVersion, packageId: string) => ConfigVersion): Promise<boolean> {
    let updated = false;
    await this.mutateState((state) => ({
      ...state,
      packages: state.packages.map((pkg) => ({
        ...pkg,
        versions: pkg.versions.map((version) => {
          if (version.id !== versionId) return version;
          updated = true;
          return updater(version, pkg.id);
        }),
      })),
    }));
    return updated;
  }

  async listVersions(): Promise<ConfigVersion[]> {
    const state = await this.readState();
    return deepCloneJson(
      state.packages.flatMap((pkg) =>
        pkg.versions.map((version) => ({
          ...version,
          packageId: pkg.id,
        })),
      ),
    );
  }

  async createApproval(approval: ApprovalRequest): Promise<void> {
    await this.mutateState((state) => ({
      ...state,
      approvals: [approval, ...state.approvals],
    }));
  }

  async readApproval(approvalId: string): Promise<ApprovalRequest | null> {
    const state = await this.readState();
    const approval = state.approvals.find((item) => item.id === approvalId);
    return approval ? deepCloneJson(approval) : null;
  }

  async updateApproval(approvalId: string, updater: (approval: ApprovalRequest) => ApprovalRequest): Promise<boolean> {
    let updated = false;
    await this.mutateState((state) => ({
      ...state,
      approvals: state.approvals.map((approval) => {
        if (approval.id !== approvalId) return approval;
        updated = true;
        return updater(approval);
      }),
    }));
    return updated;
  }

  async listApprovals(): Promise<ApprovalRequest[]> {
    const state = await this.readState();
    return deepCloneJson(state.approvals);
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.mutateState((state) => ({
      ...state,
      audit: [event, ...state.audit],
    }));
  }

  async listAudit(): Promise<AuditEvent[]> {
    const state = await this.readState();
    return deepCloneJson(state.audit);
  }

  async exportGitOpsPayload(): Promise<GitOpsPayload> {
    const state = await this.readState();
    return deepCloneJson({
      tenantId: state.tenantId,
      packages: state.packages,
      approvals: state.approvals,
      audit: state.audit,
      componentRegistry: state.componentRegistry,
    });
  }

  async importGitOpsPayload(input: GitOpsPayload): Promise<void> {
    await this.mutateState((state) => ({
      ...state,
      tenantId: input.tenantId,
      packages: deepCloneJson(input.packages),
      approvals: deepCloneJson(input.approvals),
      audit: deepCloneJson(input.audit),
      componentRegistry: deepCloneJson(input.componentRegistry),
    }));
  }

  async readState(): Promise<StoreState> {
    if (this.memory) return this.memory;

    const raw = await this.readStateFile();
    if (raw) {
      const normalized = this.init.normalizeState(raw);
      this.memory = normalized;
      // Self-heal missing fields as schema evolves.
      await this.writeStateFile(normalized);
      return normalized;
    }

    const seeded = this.init.seedState();
    this.memory = seeded;
    await this.writeStateFile(seeded);
    return seeded;
  }

  async replaceState(state: StoreState): Promise<void> {
    this.memory = deepCloneJson(state);
    this.writeChain = this.writeChain.then(async () => {
      await this.writeStateFile(this.memory!);
    });
    await this.writeChain;
  }

  async loadSigningKey(): Promise<Buffer> {
    if (this.signingKeyCache) {
      return this.signingKeyCache;
    }

    const env = process.env.RULEFLOW_GITOPS_HMAC_KEY;
    if (env && env.trim().length > 0) {
      this.signingKeyCache = Buffer.from(env.trim(), 'utf8');
      return this.signingKeyCache;
    }

    const existing = await this.readSigningKeyFile();
    if (existing && existing.trim().length > 0) {
      this.signingKeyCache = Buffer.from(existing.trim(), 'base64');
      return this.signingKeyCache;
    }

    const key = crypto.randomBytes(32);
    await this.writeSigningKeyFile(key.toString('base64'));
    this.signingKeyCache = key;
    return key;
  }

  private async mutateState(buildNext: (state: StoreState) => StoreState): Promise<void> {
    const state = await this.readState();
    const next = buildNext(state);
    await this.replaceState(next);
  }
}

class FileStore extends BaseConfigStore {
  private readonly files: StoreFilePaths;

  constructor(params: {
    init: StoreInit;
    provider: 'file' | 'tmp';
    baseDir: string;
    warning?: string;
  }) {
    super({
      init: params.init,
      provider: params.provider,
      baseDir: params.baseDir,
      canWriteToStore: true,
      warning: params.warning,
    });

    this.files = {
      stateFile: path.join(params.baseDir, STORE_FILENAME),
      signingKeyFile: path.join(params.baseDir, SIGNING_KEY_FILENAME),
    };
  }

  protected async readStateFile(): Promise<unknown | null> {
    try {
      const raw = await fs.readFile(this.files.stateFile, 'utf8');
      return JSON.parse(raw) as unknown;
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  protected async writeStateFile(state: StoreState): Promise<void> {
    await fs.mkdir(path.dirname(this.files.stateFile), { recursive: true });
    await fs.writeFile(this.files.stateFile, JSON.stringify(state, null, 2), 'utf8');
  }

  protected async readSigningKeyFile(): Promise<string | null> {
    try {
      return await fs.readFile(this.files.signingKeyFile, 'utf8');
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  protected async writeSigningKeyFile(encoded: string): Promise<void> {
    await fs.mkdir(path.dirname(this.files.signingKeyFile), { recursive: true });
    await fs.writeFile(this.files.signingKeyFile, encoded, 'utf8');
  }
}

class InMemoryStore extends BaseConfigStore {
  private persistedState: StoreState | null;
  private persistedSigningKey: string | null = null;

  constructor(params: {
    init: StoreInit;
    initialState?: StoreState;
    warning: string;
  }) {
    super({
      init: params.init,
      provider: 'memory',
      baseDir: null,
      canWriteToStore: false,
      warning: params.warning,
      initialState: params.initialState,
    });

    this.persistedState = params.initialState ? deepCloneJson(params.initialState) : null;
  }

  protected async readStateFile(): Promise<unknown | null> {
    return this.persistedState ? deepCloneJson(this.persistedState) : null;
  }

  protected async writeStateFile(state: StoreState): Promise<void> {
    this.persistedState = deepCloneJson(state);
  }

  protected async readSigningKeyFile(): Promise<string | null> {
    return this.persistedSigningKey;
  }

  protected async writeSigningKeyFile(encoded: string): Promise<void> {
    this.persistedSigningKey = encoded;
  }
}

export async function createConfigStore(options: ConfigStoreFactoryOptions): Promise<ConfigStore> {
  const init: StoreInit = {
    seedState: options.seedState,
    normalizeState: options.normalizeState,
  };

  const logger = options.logger ?? defaultLogger;
  const canWrite = options.canWriteToDirectory ?? defaultCanWriteToDirectory;

  const defaultDir = options.defaultDir ?? process.env.RULEFLOW_DEMO_STORE_DIR ?? path.join(process.cwd(), '.ruleflow-demo-data');
  const tmpDir = options.tmpDir ?? process.env.RULEFLOW_DEMO_TMP_STORE_DIR ?? DEFAULT_TMP_DIR;
  const vercel = options.vercel ?? process.env.VERCEL;

  if (vercel === '1') {
    if (await canWrite(tmpDir)) {
      return new FileStore({ init, provider: 'tmp', baseDir: tmpDir });
    }

    const warning = `[ruleflow-demo] Could not write tmp store at ${tmpDir}. Falling back to in-memory store.`;
    logger(warning);
    return new InMemoryStore({ init, warning });
  }

  if (await canWrite(defaultDir)) {
    return new FileStore({ init, provider: 'file', baseDir: defaultDir });
  }

  if (await canWrite(tmpDir)) {
    const warning = `[ruleflow-demo] Primary store path ${defaultDir} is read-only. Using tmp store ${tmpDir}.`;
    logger(warning);
    return new FileStore({ init, provider: 'tmp', baseDir: tmpDir, warning });
  }

  const warning = `[ruleflow-demo] Neither ${defaultDir} nor ${tmpDir} is writable. Falling back to in-memory store.`;
  logger(warning);
  return new InMemoryStore({ init, warning });
}

class ConfigStoreManager {
  private readonly options: ConfigStoreFactoryOptions;
  private store: ConfigStore | null = null;
  private storePromise: Promise<ConfigStore> | null = null;

  constructor(options: ConfigStoreFactoryOptions) {
    this.options = options;
  }

  async getStore(): Promise<ConfigStore> {
    return this.ensureStore();
  }

  async getDiagnostics(): Promise<ConfigStoreDiagnostics> {
    const store = await this.ensureStore();
    return toDiagnostics(store);
  }

  async readState(): Promise<StoreState> {
    return this.withWriteFallback(async (store) => store.readState());
  }

  async replaceState(state: StoreState): Promise<void> {
    await this.withWriteFallback(async (store) => {
      await store.replaceState(state);
    });
  }

  async loadSigningKey(): Promise<Buffer> {
    return this.withWriteFallback(async (store) => store.loadSigningKey());
  }

  resetForTests() {
    this.store = null;
    this.storePromise = null;
  }

  private async ensureStore(): Promise<ConfigStore> {
    if (this.store) return this.store;

    if (!this.storePromise) {
      this.storePromise = createConfigStore(this.options).then((created) => {
        this.store = created;
        return created;
      });
    }

    return this.storePromise;
  }

  private async withWriteFallback<T>(fn: (store: ConfigStore) => Promise<T>): Promise<T> {
    const current = await this.ensureStore();

    try {
      return await fn(current);
    } catch (error) {
      if (!isWriteError(error) || current.provider === 'memory') {
        throw error;
      }

      const fallback = await this.fallbackToInMemory(current, error);

      try {
        return await fn(fallback);
      } catch (fallbackError) {
        throw new PersistenceUnavailableError(
          'Persistence unavailable, check store provider',
          toDiagnostics(fallback),
          fallbackError,
        );
      }
    }
  }

  private async fallbackToInMemory(current: ConfigStore, cause: unknown): Promise<ConfigStore> {
    const init: StoreInit = {
      seedState: this.options.seedState,
      normalizeState: this.options.normalizeState,
    };
    const logger = this.options.logger ?? defaultLogger;

    let snapshot: StoreState | undefined;
    try {
      snapshot = await current.readState();
    } catch {
      snapshot = this.options.seedState();
    }

    const warning = `[ruleflow-demo] ${current.provider} store write failed. Falling back to in-memory store.`;
    logger(warning);

    const fallback = new InMemoryStore({
      init,
      initialState: snapshot,
      warning,
    });

    this.store = fallback;
    this.storePromise = Promise.resolve(fallback);

    if (cause instanceof Error && !isWriteError(cause)) {
      throw cause;
    }

    return fallback;
  }
}

export function createConfigStoreManager(options: ConfigStoreFactoryOptions) {
  return new ConfigStoreManager(options);
}
