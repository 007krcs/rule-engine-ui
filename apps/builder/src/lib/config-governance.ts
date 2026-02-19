import type { ApplicationBundle, ApplicationBundleStatus, JSONValue } from '@platform/schema';

export type ConfigVersionStatus = ApplicationBundleStatus;

export interface ConfigVersionRecord {
  id: string;
  version: number;
  status: ConfigVersionStatus;
  bundle: ApplicationBundle;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ConfigPackage {
  id: string;
  name: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  versions: ConfigVersionRecord[];
}

export interface AuditLogEntry {
  id: string;
  packageId: string;
  versionId: string;
  timestamp: string;
  actor?: string;
  action: string;
  summary: string;
  metadata?: Record<string, JSONValue>;
}

export interface ConfigStoreState {
  schemaVersion: 1;
  packages: ConfigPackage[];
  activePackageId?: string;
  activeVersionId?: string;
  audit: AuditLogEntry[];
}

export type ConfigStoreResult<T> =
  | { ok: true; state: ConfigStoreState; value: T }
  | { ok: false; state: ConfigStoreState; error: string };

const STORAGE_KEY = 'rf:builder-config-store:v1';
const MAX_AUDIT_ENTRIES = 200;
let memoryStore: ConfigStoreState | null = null;

export function createEmptyConfigStore(): ConfigStoreState {
  return {
    schemaVersion: 1,
    packages: [],
    audit: [],
  };
}

export function loadConfigStore(): ConfigStoreState {
  if (typeof window === 'undefined') {
    return memoryStore ?? createEmptyConfigStore();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyConfigStore();
    const parsed = JSON.parse(raw) as Partial<ConfigStoreState> | null;
    if (!parsed || typeof parsed !== 'object') return createEmptyConfigStore();
    return {
      schemaVersion: 1,
      packages: Array.isArray(parsed.packages) ? parsed.packages : [],
      activePackageId: parsed.activePackageId,
      activeVersionId: parsed.activeVersionId,
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    };
  } catch {
    return createEmptyConfigStore();
  }
}

export function persistConfigStore(state: ConfigStoreState): void {
  if (typeof window === 'undefined') {
    memoryStore = state;
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
}

export function getActivePackage(state: ConfigStoreState): ConfigPackage | undefined {
  if (state.activePackageId) {
    const match = state.packages.find((pkg) => pkg.id === state.activePackageId);
    if (match) return match;
  }
  return state.packages[0];
}

export function getActiveVersion(state: ConfigStoreState): ConfigVersionRecord | undefined {
  const pkg = getActivePackage(state);
  if (!pkg) return undefined;
  if (state.activeVersionId) {
    const match = pkg.versions.find((version) => version.id === state.activeVersionId);
    if (match) return match;
  }
  return getLatestVersion(pkg);
}

export function getLatestVersion(pkg: ConfigPackage | undefined): ConfigVersionRecord | undefined {
  if (!pkg || pkg.versions.length === 0) return undefined;
  return [...pkg.versions].sort((a, b) => b.version - a.version)[0];
}

export function setActiveVersion(
  state: ConfigStoreState,
  packageId: string,
  versionId: string,
): ConfigStoreState {
  return {
    ...state,
    activePackageId: packageId,
    activeVersionId: versionId,
  };
}

export function createConfigPackage(
  state: ConfigStoreState,
  input: {
    id: string;
    name?: string;
    tenantId: string;
    bundle: ApplicationBundle;
    actor?: string;
  },
): ConfigStoreResult<{ package: ConfigPackage; version: ConfigVersionRecord }> {
  if (state.packages.some((pkg) => pkg.id === input.id)) {
    return {
      ok: false,
      state,
      error: `Config package "${input.id}" already exists.`,
    };
  }

  const now = new Date().toISOString();
  const normalizedBundle = applyBundleMetadata(input.bundle, {
    configId: input.id,
    tenantId: input.tenantId,
    version: 1,
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
    createdBy: input.actor,
    updatedBy: input.actor,
  });

  const version: ConfigVersionRecord = {
    id: createId('version'),
    version: 1,
    status: 'DRAFT',
    bundle: normalizedBundle,
    createdAt: now,
    updatedAt: now,
    createdBy: input.actor,
    updatedBy: input.actor,
  };

  const pkg: ConfigPackage = {
    id: input.id,
    name: input.name ?? input.id,
    tenantId: input.tenantId,
    createdAt: now,
    updatedAt: now,
    createdBy: input.actor,
    versions: [version],
  };

  const next: ConfigStoreState = {
    ...state,
    packages: [...state.packages, pkg],
    activePackageId: pkg.id,
    activeVersionId: version.id,
  };

  return { ok: true, state: next, value: { package: pkg, version } };
}

export function createDraftVersion(
  state: ConfigStoreState,
  input: {
    packageId: string;
    bundle: ApplicationBundle;
    actor?: string;
  },
): ConfigStoreResult<ConfigVersionRecord> {
  const pkg = state.packages.find((entry) => entry.id === input.packageId);
  if (!pkg) {
    return { ok: false, state, error: `Config package "${input.packageId}" not found.` };
  }

  if (pkg.versions.some((version) => version.status === 'DRAFT')) {
    return { ok: false, state, error: 'A draft already exists for this config.' };
  }

  const now = new Date().toISOString();
  const nextVersionNumber = Math.max(0, ...pkg.versions.map((version) => version.version)) + 1;
  const normalizedBundle = applyBundleMetadata(input.bundle, {
    configId: pkg.id,
    tenantId: pkg.tenantId,
    version: nextVersionNumber,
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
    createdBy: input.actor,
    updatedBy: input.actor,
  });

  const version: ConfigVersionRecord = {
    id: createId('version'),
    version: nextVersionNumber,
    status: 'DRAFT',
    bundle: normalizedBundle,
    createdAt: now,
    updatedAt: now,
    createdBy: input.actor,
    updatedBy: input.actor,
  };

  const nextPackage: ConfigPackage = {
    ...pkg,
    updatedAt: now,
    versions: [...pkg.versions, version],
  };

  const nextState: ConfigStoreState = {
    ...state,
    packages: state.packages.map((entry) => (entry.id === pkg.id ? nextPackage : entry)),
    activePackageId: pkg.id,
    activeVersionId: version.id,
  };

  return { ok: true, state: nextState, value: version };
}

export function saveDraftVersion(
  state: ConfigStoreState,
  input: {
    packageId: string;
    versionId: string;
    bundle: ApplicationBundle;
    actor?: string;
  },
): ConfigStoreResult<ConfigVersionRecord> {
  const pkg = state.packages.find((entry) => entry.id === input.packageId);
  if (!pkg) {
    return { ok: false, state, error: `Config package "${input.packageId}" not found.` };
  }

  const version = pkg.versions.find((entry) => entry.id === input.versionId);
  if (!version) {
    return { ok: false, state, error: 'Draft version not found.' };
  }

  if (version.status !== 'DRAFT' && version.status !== 'REJECTED') {
    return { ok: false, state, error: 'Only draft or rejected versions can be saved.' };
  }

  const now = new Date().toISOString();
  const normalizedBundle = applyBundleMetadata(input.bundle, {
    configId: pkg.id,
    tenantId: pkg.tenantId,
    version: version.version,
    status: version.status,
    createdAt: version.createdAt,
    updatedAt: now,
    createdBy: version.createdBy,
    updatedBy: input.actor,
  });

  const nextVersion: ConfigVersionRecord = {
    ...version,
    bundle: normalizedBundle,
    updatedAt: now,
    updatedBy: input.actor,
  };

  const nextPackage: ConfigPackage = {
    ...pkg,
    updatedAt: now,
    versions: pkg.versions.map((entry) => (entry.id === version.id ? nextVersion : entry)),
  };

  const nextState: ConfigStoreState = {
    ...state,
    packages: state.packages.map((entry) => (entry.id === pkg.id ? nextPackage : entry)),
  };

  return { ok: true, state: nextState, value: nextVersion };
}

export function updateVersionStatus(
  state: ConfigStoreState,
  input: {
    packageId: string;
    versionId: string;
    status: ConfigVersionStatus;
    actor?: string;
  },
): ConfigStoreResult<ConfigVersionRecord> {
  const pkg = state.packages.find((entry) => entry.id === input.packageId);
  if (!pkg) {
    return { ok: false, state, error: `Config package "${input.packageId}" not found.` };
  }

  const version = pkg.versions.find((entry) => entry.id === input.versionId);
  if (!version) {
    return { ok: false, state, error: 'Version not found.' };
  }

  const now = new Date().toISOString();
  const nextVersion: ConfigVersionRecord = {
    ...version,
    status: input.status,
    updatedAt: now,
    updatedBy: input.actor,
    bundle: applyBundleMetadata(version.bundle, {
      status: input.status,
      updatedAt: now,
      updatedBy: input.actor,
    }),
  };

  const nextVersions = pkg.versions.map((entry) => {
    if (entry.id === version.id) return nextVersion;
    if (input.status === 'PUBLISHED' && entry.status === 'PUBLISHED') {
      return {
        ...entry,
        status: 'ARCHIVED',
        updatedAt: now,
        updatedBy: input.actor,
        bundle: applyBundleMetadata(entry.bundle, {
          status: 'ARCHIVED',
          updatedAt: now,
          updatedBy: input.actor,
        }),
      };
    }
    return entry;
  });

  const nextPackage: ConfigPackage = {
    ...pkg,
    updatedAt: now,
    versions: nextVersions,
  };

  const nextState: ConfigStoreState = {
    ...state,
    packages: state.packages.map((entry) => (entry.id === pkg.id ? nextPackage : entry)),
  };

  return { ok: true, state: nextState, value: nextVersion };
}

export function recordAuditEntry(state: ConfigStoreState, entry: AuditLogEntry): ConfigStoreState {
  const nextAudit = [...state.audit, entry].slice(-MAX_AUDIT_ENTRIES);
  return {
    ...state,
    audit: nextAudit,
  };
}

function applyBundleMetadata(
  bundle: ApplicationBundle,
  patch: Partial<ApplicationBundle['metadata']>,
): ApplicationBundle {
  return {
    ...bundle,
    metadata: {
      ...bundle.metadata,
      ...patch,
    },
  };
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
