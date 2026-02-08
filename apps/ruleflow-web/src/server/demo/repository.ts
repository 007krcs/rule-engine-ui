import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  ApprovalRequest,
  AuditEvent,
  ConfigBundle,
  ConfigPackage,
  ConfigStatus,
  ConfigVersion,
  GitOpsBundle,
  JsonDiffItem,
  RiskLevel,
} from '@/lib/demo/types';
import { getMockSession } from '@/lib/auth';
import exampleUi from '@platform/schema/examples/example.ui.json';
import exampleFlow from '@platform/schema/examples/example.flow.json';
import exampleRules from '@platform/schema/examples/example.rules.json';
import exampleApi from '@platform/schema/examples/example.api.json';

type StoreState = {
  schemaVersion: 1;
  tenantId: string;
  packages: ConfigPackage[];
  approvals: ApprovalRequest[];
  audit: AuditEvent[];
};

const STORE_DIR = process.env.RULEFLOW_DEMO_STORE_DIR ?? path.join(process.cwd(), '.ruleflow-demo-data');
const STORE_FILE = path.join(STORE_DIR, 'store.json');

const STORE_SEVERITY_FOR_STATUS: Record<ConfigStatus, AuditEvent['severity']> = {
  DRAFT: 'info',
  REVIEW: 'info',
  APPROVED: 'info',
  ACTIVE: 'info',
  DEPRECATED: 'warning',
  RETIRED: 'warning',
};

let memory: StoreState | null = null;
let writeChain: Promise<void> = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function withClockSkew(isoNow: string, msDelta: number) {
  return new Date(new Date(isoNow).getTime() + msDelta).toISOString();
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function ensureDir() {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

async function readStoreFile(): Promise<StoreState | null> {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    return JSON.parse(raw) as StoreState;
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeStoreFile(state: StoreState): Promise<void> {
  await ensureDir();
  await fs.writeFile(STORE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function loadState(): Promise<StoreState> {
  if (memory) return memory;
  const existing = await readStoreFile();
  if (existing) {
    memory = existing;
    return existing;
  }
  const seeded = seedState();
  memory = seeded;
  await writeStoreFile(seeded);
  return seeded;
}

async function persistState(next: StoreState): Promise<void> {
  memory = next;
  writeChain = writeChain.then(() => writeStoreFile(next));
  await writeChain;
}

function seedBundle(variant: 'active' | 'review' | 'deprecated'): ConfigBundle {
  const uiSchema = deepCloneJson(exampleUi);
  const flowSchema = deepCloneJson(exampleFlow);
  const rules = deepCloneJson(exampleRules) as unknown as { version: string; rules: unknown[] };
  const apiMapping = deepCloneJson(exampleApi);

  if (variant === 'review') {
    // Make the REVIEW bundle meaningfully different for diffing.
    (flowSchema as any).version = '1.0.1';
    (uiSchema as any).version = '1.0.1';
  }
  if (variant === 'deprecated') {
    (flowSchema as any).version = '0.9.9';
    (uiSchema as any).version = '0.9.9';
  }

  return {
    uiSchema: uiSchema as any,
    flowSchema: flowSchema as any,
    rules: rules as any,
    apiMappingsById: {
      submitOrder: apiMapping as any,
    },
  };
}

function seedState(): StoreState {
  const session = getMockSession();
  const seededAt = nowIso();

  const packageId = 'pkg-horizon-orders';
  const activeVersionId = 'ver-2026.01.30';
  const reviewVersionId = 'ver-2026.02.07-rc1';
  const deprecatedVersionId = 'ver-2025.12.18';

  const versions: ConfigVersion[] = [
    {
      id: reviewVersionId,
      packageId,
      version: '2026.02.07-rc1',
      status: 'REVIEW',
      createdAt: withClockSkew(seededAt, -2 * 60 * 60 * 1000),
      createdBy: session.user.name,
      bundle: seedBundle('review'),
    },
    {
      id: activeVersionId,
      packageId,
      version: '2026.01.30',
      status: 'ACTIVE',
      createdAt: withClockSkew(seededAt, -7 * 24 * 60 * 60 * 1000),
      createdBy: 'Yuki Tanaka',
      bundle: seedBundle('active'),
    },
    {
      id: deprecatedVersionId,
      packageId,
      version: '2025.12.18',
      status: 'DEPRECATED',
      createdAt: withClockSkew(seededAt, -60 * 24 * 60 * 60 * 1000),
      createdBy: 'Alex Chen',
      bundle: seedBundle('deprecated'),
    },
  ];

  const pkg: ConfigPackage = {
    id: packageId,
    name: 'Orders Bundle',
    description: 'UI + flow + rules + API mapping for order workflows (demo).',
    createdAt: withClockSkew(seededAt, -90 * 24 * 60 * 60 * 1000),
    createdBy: 'System',
    versions,
  };

  const approvals: ApprovalRequest[] = [
    {
      id: 'apr-1072',
      versionId: reviewVersionId,
      packageId,
      requestedBy: session.user.name,
      requestedAt: withClockSkew(seededAt, -90 * 60 * 1000),
      scope: 'Tenant: Horizon Bank',
      risk: 'Medium',
      status: 'PENDING',
    },
    {
      id: 'apr-1071',
      versionId: reviewVersionId,
      packageId,
      requestedBy: session.user.name,
      requestedAt: withClockSkew(seededAt, -110 * 60 * 1000),
      scope: 'Tenant: Nova Credit',
      risk: 'Low',
      status: 'PENDING',
    },
  ];

  const audit: AuditEvent[] = [
    {
      id: 'evt-9911',
      at: withClockSkew(seededAt, -2 * 60 * 60 * 1000),
      actor: 'Yuki Tanaka',
      action: 'Promoted config to ACTIVE',
      target: `${packageId}@2026.01.30`,
      severity: 'info',
    },
    {
      id: 'evt-9910',
      at: withClockSkew(seededAt, -4 * 60 * 60 * 1000),
      actor: 'System',
      action: 'Replay executed',
      target: 'flow:order-flow v1.0.0',
      severity: 'info',
    },
    {
      id: 'evt-9907',
      at: withClockSkew(seededAt, -24 * 60 * 60 * 1000),
      actor: 'Alex Chen',
      action: 'Deprecated config',
      target: `${packageId}@2025.12.18`,
      severity: 'warning',
    },
  ];

  return {
    schemaVersion: 1,
    tenantId: session.tenantId,
    packages: [pkg],
    approvals,
    audit,
  };
}

function flattenVersions(packages: ConfigPackage[]): ConfigVersion[] {
  return packages.flatMap((pkg) => pkg.versions.map((version) => ({ ...version, packageId: pkg.id })));
}

function sortByCreatedDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function sortAuditDesc(items: AuditEvent[]) {
  return [...items].sort((a, b) => (a.at < b.at ? 1 : -1));
}

function diffJson(before: unknown, after: unknown, basePath = ''): JsonDiffItem[] {
  if (Object.is(before, after)) return [];

  const beforeIsObj = typeof before === 'object' && before !== null;
  const afterIsObj = typeof after === 'object' && after !== null;

  if (!beforeIsObj || !afterIsObj) {
    return [{ path: basePath || 'root', before, after }];
  }

  const beforeArr = Array.isArray(before);
  const afterArr = Array.isArray(after);
  if (beforeArr || afterArr) {
    if (!beforeArr || !afterArr) {
      return [{ path: basePath || 'root', before, after }];
    }
    const max = Math.max((before as unknown[]).length, (after as unknown[]).length);
    const out: JsonDiffItem[] = [];
    for (let i = 0; i < max; i += 1) {
      const nextPath = `${basePath}[${i}]`;
      out.push(...diffJson((before as unknown[])[i], (after as unknown[])[i], nextPath));
    }
    return out;
  }

  const beforeRec = before as Record<string, unknown>;
  const afterRec = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(beforeRec), ...Object.keys(afterRec)]);
  const out: JsonDiffItem[] = [];
  for (const key of keys) {
    const nextPath = basePath ? `${basePath}.${key}` : key;
    out.push(...diffJson(beforeRec[key], afterRec[key], nextPath));
  }
  return out;
}

function addAudit(state: StoreState, event: Omit<AuditEvent, 'id' | 'at'> & { at?: string }): StoreState {
  const at = event.at ?? nowIso();
  const nextEvent: AuditEvent = { ...event, id: id('evt'), at };
  return { ...state, audit: [nextEvent, ...state.audit] };
}

function updateVersionInPackage(pkg: ConfigPackage, versionId: string, updater: (v: ConfigVersion) => ConfigVersion) {
  return {
    ...pkg,
    versions: pkg.versions.map((v) => (v.id === versionId ? updater(v) : v)),
  };
}

export async function getConsoleSnapshot() {
  const state = await loadState();
  const versions = sortByCreatedDesc(flattenVersions(state.packages));
  const approvals = [...state.approvals].sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
  return {
    tenantId: state.tenantId,
    packages: state.packages,
    versions,
    approvals,
    audit: sortAuditDesc(state.audit),
  };
}

export async function getConfigVersion(versionId: string): Promise<ConfigVersion | null> {
  const state = await loadState();
  for (const pkg of state.packages) {
    const version = pkg.versions.find((v) => v.id === versionId);
    if (version) return { ...version, packageId: pkg.id };
  }
  return null;
}

export async function createConfigPackage(input: { name: string; description?: string }) {
  const session = getMockSession();
  const state = await loadState();

  const packageId = id('pkg');
  const versionId = id('ver');
  const createdAt = nowIso();

  const newVersion: ConfigVersion = {
    id: versionId,
    packageId,
    version: new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, '.') + '-draft',
    status: 'DRAFT',
    createdAt,
    createdBy: session.user.name,
    bundle: seedBundle('active'),
  };

  const pkg: ConfigPackage = {
    id: packageId,
    name: input.name.trim() || 'Untitled Package',
    description: input.description?.trim() || undefined,
    createdAt,
    createdBy: session.user.name,
    versions: [newVersion],
  };

  let next: StoreState = {
    ...state,
    packages: [pkg, ...state.packages],
  };
  next = addAudit(next, {
    actor: session.user.name,
    action: 'Created config package',
    target: `${pkg.id}`,
    severity: 'info',
    metadata: { packageName: pkg.name, versionId: newVersion.id },
  });
  await persistState(next);

  return { packageId, versionId };
}

export async function updateUiSchema(input: { versionId: string; uiSchema: ConfigBundle['uiSchema'] }) {
  const session = getMockSession();
  const state = await loadState();

  let updated = false;
  const nextPackages = state.packages.map((pkg) => {
    const version = pkg.versions.find((v) => v.id === input.versionId);
    if (!version) return pkg;

    updated = true;
    return updateVersionInPackage(pkg, input.versionId, (v) => ({
      ...v,
      bundle: { ...v.bundle, uiSchema: input.uiSchema },
      updatedAt: nowIso(),
      updatedBy: session.user.name,
    }));
  });

  if (!updated) return { ok: false as const, error: 'Version not found' };

  let next: StoreState = { ...state, packages: nextPackages };
  next = addAudit(next, {
    actor: session.user.name,
    action: 'Updated UI schema',
    target: `${input.versionId}`,
    severity: 'info',
  });
  await persistState(next);
  return { ok: true as const };
}

export async function submitForReview(input: { versionId: string; scope: string; risk: RiskLevel }) {
  const session = getMockSession();
  const state = await loadState();

  let packageId: string | null = null;
  let versionLabel: string | null = null;

  const nextPackages = state.packages.map((pkg) => {
    const version = pkg.versions.find((v) => v.id === input.versionId);
    if (!version) return pkg;
    packageId = pkg.id;
    versionLabel = version.version;
    return updateVersionInPackage(pkg, input.versionId, (v) => ({ ...v, status: 'REVIEW', updatedAt: nowIso(), updatedBy: session.user.name }));
  });

  if (!packageId) return { ok: false as const, error: 'Version not found' };

  const approval: ApprovalRequest = {
    id: id('apr'),
    versionId: input.versionId,
    packageId,
    requestedBy: session.user.name,
    requestedAt: nowIso(),
    scope: input.scope,
    risk: input.risk,
    status: 'PENDING',
  };

  let next: StoreState = {
    ...state,
    packages: nextPackages,
    approvals: [approval, ...state.approvals],
  };

  next = addAudit(next, {
    actor: session.user.name,
    action: 'Submitted version for review',
    target: `${packageId}@${versionLabel ?? input.versionId}`,
    severity: 'info',
    metadata: { approvalId: approval.id, scope: input.scope, risk: input.risk },
  });

  await persistState(next);
  return { ok: true as const, approvalId: approval.id };
}

export async function approveRequest(input: { approvalId: string }) {
  const session = getMockSession();
  const state = await loadState();

  const approval = state.approvals.find((a) => a.id === input.approvalId);
  if (!approval) return { ok: false as const, error: 'Approval not found' };

  const nextApprovals = state.approvals.map((a) =>
    a.id === input.approvalId
      ? { ...a, status: 'APPROVED' as const, decidedBy: session.user.name, decidedAt: nowIso() }
      : a,
  );

  const nextPackages = state.packages.map((pkg) => {
    if (pkg.id !== approval.packageId) return pkg;
    return updateVersionInPackage(pkg, approval.versionId, (v) => ({
      ...v,
      status: 'APPROVED',
      updatedAt: nowIso(),
      updatedBy: session.user.name,
    }));
  });

  let next: StoreState = { ...state, approvals: nextApprovals, packages: nextPackages };
  next = addAudit(next, {
    actor: session.user.name,
    action: 'Approved change request',
    target: `${approval.packageId}@${approval.versionId}`,
    severity: 'info',
    metadata: { approvalId: approval.id, scope: approval.scope, risk: approval.risk },
  });
  await persistState(next);
  return { ok: true as const };
}

export async function requestChanges(input: { approvalId: string; notes?: string }) {
  const session = getMockSession();
  const state = await loadState();

  const approval = state.approvals.find((a) => a.id === input.approvalId);
  if (!approval) return { ok: false as const, error: 'Approval not found' };

  const nextApprovals = state.approvals.map((a) =>
    a.id === input.approvalId
      ? {
          ...a,
          status: 'CHANGES_REQUESTED' as const,
          decidedBy: session.user.name,
          decidedAt: nowIso(),
          notes: input.notes?.trim() || undefined,
        }
      : a,
  );

  const nextPackages = state.packages.map((pkg) => {
    if (pkg.id !== approval.packageId) return pkg;
    return updateVersionInPackage(pkg, approval.versionId, (v) => ({
      ...v,
      status: 'DRAFT',
      updatedAt: nowIso(),
      updatedBy: session.user.name,
    }));
  });

  let next: StoreState = { ...state, approvals: nextApprovals, packages: nextPackages };
  next = addAudit(next, {
    actor: session.user.name,
    action: 'Requested changes',
    target: `${approval.packageId}@${approval.versionId}`,
    severity: 'warning',
    metadata: { approvalId: approval.id, notes: input.notes },
  });
  await persistState(next);
  return { ok: true as const };
}

export async function promoteVersion(input: { versionId: string }) {
  const session = getMockSession();
  const state = await loadState();

  let found: { pkg: ConfigPackage; version: ConfigVersion } | null = null;
  for (const pkg of state.packages) {
    const version = pkg.versions.find((v) => v.id === input.versionId);
    if (version) {
      found = { pkg, version };
      break;
    }
  }

  if (!found) return { ok: false as const, error: 'Version not found' };
  if (found.version.status !== 'APPROVED') {
    return { ok: false as const, error: `Cannot promote version in status ${found.version.status}` };
  }

  const nextPackages = state.packages.map((pkg) => {
    if (pkg.id !== found!.pkg.id) return pkg;
    return {
      ...pkg,
      versions: pkg.versions.map((v) => {
        if (v.id === found!.version.id) {
          return { ...v, status: 'ACTIVE' as const, updatedAt: nowIso(), updatedBy: session.user.name };
        }
        if (v.status === 'ACTIVE') {
          return { ...v, status: 'DEPRECATED' as const, updatedAt: nowIso(), updatedBy: session.user.name };
        }
        return v;
      }),
    };
  });

  let next: StoreState = { ...state, packages: nextPackages };
  next = addAudit(next, {
    actor: session.user.name,
    action: 'Promoted version to ACTIVE',
    target: `${found.pkg.id}@${found.version.version}`,
    severity: STORE_SEVERITY_FOR_STATUS.ACTIVE,
  });
  await persistState(next);
  return { ok: true as const };
}

export async function diffVersion(input: { versionId: string; againstVersionId?: string | null }) {
  const state = await loadState();

  let before: ConfigVersion | null = null;
  let after: ConfigVersion | null = null;
  let packageId: string | null = null;

  for (const pkg of state.packages) {
    const candidate = pkg.versions.find((v) => v.id === input.versionId);
    if (candidate) {
      after = candidate;
      packageId = pkg.id;
      break;
    }
  }
  if (!after || !packageId) return { ok: false as const, error: 'Version not found' };

  if (input.againstVersionId) {
    for (const pkg of state.packages) {
      const candidate = pkg.versions.find((v) => v.id === input.againstVersionId);
      if (candidate) {
        before = candidate;
        break;
      }
    }
  } else {
    const pkg = state.packages.find((p) => p.id === packageId);
    before = pkg?.versions.find((v) => v.status === 'ACTIVE') ?? null;
  }

  if (!before) return { ok: false as const, error: 'Baseline version not found' };

  const diffs = diffJson(before.bundle, after.bundle);
  return {
    ok: true as const,
    packageId,
    before: { id: before.id, version: before.version },
    after: { id: after.id, version: after.version },
    diffs,
  };
}

export async function exportGitOpsBundle(): Promise<GitOpsBundle> {
  const state = await loadState();
  return {
    schemaVersion: 1,
    exportedAt: nowIso(),
    tenantId: state.tenantId,
    packages: state.packages,
    approvals: state.approvals,
    audit: state.audit,
  };
}

export async function importGitOpsBundle(input: { bundle: GitOpsBundle }) {
  const session = getMockSession();
  const bundle = input.bundle;
  if (bundle.schemaVersion !== 1) {
    return { ok: false as const, error: `Unsupported bundle schemaVersion ${String(bundle.schemaVersion)}` };
  }

  let next: StoreState = {
    schemaVersion: 1,
    tenantId: bundle.tenantId,
    packages: bundle.packages,
    approvals: bundle.approvals,
    audit: bundle.audit,
  };

  next = addAudit(next, {
    actor: session.user.name,
    action: 'Imported GitOps bundle',
    target: `tenant:${bundle.tenantId}`,
    severity: 'info',
    metadata: { exportedAt: bundle.exportedAt },
  });

  await persistState(next);
  return { ok: true as const };
}

export async function resetDemoStore() {
  const seeded = seedState();
  await persistState(seeded);
  return { ok: true as const };
}
