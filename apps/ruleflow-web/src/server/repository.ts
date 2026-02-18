import crypto from 'node:crypto';
import type { GitOpsPayload, JsonRecord, KillScope, PostgresTenantRepository, RepoSession, RiskLevel } from '@platform/persistence-postgres';
import exampleApi from '@platform/schema/examples/example.api.json';
import exampleFlow from '@platform/schema/examples/example.flow.json';
import exampleRules from '@platform/schema/examples/example.rules.json';
import exampleUi from '@platform/schema/examples/example.ui.json';
import { getMockSession, type Role } from '@/lib/auth';
import type { ConfigBundle, ConfigVersion, ConsoleSnapshot, GitOpsBundle, JsonDiffItem } from '@/lib/demo/types';
import { applyUiPageUpdateToBundle, createSinglePageBundle } from '@/lib/demo/ui-pages';
import { buildGitOpsBundlePayloadFromPostgres, normalizeGitOpsBundleForPostgres } from '@/server/gitops';
import * as demo from '@/server/demo/repository';
import { recordRuntimeTrace } from '@/server/metrics';
import {
  evaluatePolicies,
  listPolicies,
  registerPolicy,
  requireRole,
  type PolicyCheckStage,
  type PolicyError,
  unregisterPolicy,
} from '@/server/policy-engine';

type ProviderMode = 'demo' | 'postgres';
type PostgresRepositoryConstructor = {
  create(input: { connectionString?: string; runMigrationsOnBoot?: boolean }): Promise<PostgresTenantRepository>;
};

type RuntimeKillSource = {
  scope: KillScope | 'VERSION';
  reason?: string;
};

type RuntimeKillState = {
  active: boolean;
  reason?: string;
  sources: RuntimeKillSource[];
};

let postgresRepoPromise: Promise<PostgresTenantRepository> | null = null;

function providerMode(): ProviderMode {
  if (process.env.RULEFLOW_PERSISTENCE_PROVIDER === 'demo') {
    return 'demo';
  }
  return process.env.DATABASE_URL ? 'postgres' : 'demo';
}

async function getPostgresRepo(): Promise<PostgresTenantRepository> {
  if (!postgresRepoPromise) {
    const PostgresRepository = await loadPostgresRepositoryConstructor();
    postgresRepoPromise = PostgresRepository.create({
      connectionString: process.env.DATABASE_URL,
      runMigrationsOnBoot: true,
    });
  }
  return await postgresRepoPromise;
}

async function loadPostgresRepositoryConstructor(): Promise<PostgresRepositoryConstructor> {
  const moduleName = '@platform/persistence-postgres';
  try {
    const mod = (await import(moduleName)) as {
      PostgresTenantRepository: PostgresRepositoryConstructor;
    };
    return mod.PostgresTenantRepository;
  } catch (error) {
    throw new RepositoryUnavailableError(
      `Postgres persistence package is unavailable. Install workspace deps before enabling DATABASE_URL. (${String(error)})`,
    );
  }
}

function toRepoSession(): RepoSession {
  const session = getMockSession();
  return {
    tenantId: session.tenantId,
    userId: session.user.id,
    userName: session.user.name,
    roles: session.roles,
  };
}

function policyFailure(errors: PolicyError[]) {
  return {
    ok: false as const,
    error: 'policy_failed',
    policyErrors: errors,
  };
}

function versionKilledFailure(reason?: string) {
  return {
    ok: false as const,
    error: 'version_killed',
    message: reason
      ? `Version is disabled by an active kill switch (${reason})`
      : 'Version is disabled by an active kill switch',
  };
}

async function evaluatePolicyStage(input: {
  stage: PolicyCheckStage;
  requiredRole?: Role;
  currentBundle?: ConfigBundle;
  nextBundle?: ConfigBundle;
  metadata?: Record<string, unknown>;
}) {
  const session = getMockSession();
  const errors: PolicyError[] = [];

  if (input.requiredRole) {
    errors.push(...requireRole({ session }, input.requiredRole, input.stage));
  }
  errors.push(
    ...(await evaluatePolicies({
      stage: input.stage,
      tenantId: session.tenantId,
      userId: session.user.id,
      roles: session.roles,
      currentBundle: input.currentBundle,
      nextBundle: input.nextBundle,
      metadata: input.metadata,
    })),
  );

  return errors;
}

function toFeatureFlagMap(
  flags: ReadonlyArray<{
    key: string;
    enabled: boolean;
  }>,
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const flag of flags) {
    map[flag.key] = flag.enabled;
  }
  return map;
}

function killSwitchMatchesVersion(
  killSwitch: {
    scope: KillScope;
    active: boolean;
    versionId?: string;
    packageId?: string;
    reason?: string;
  },
  input: { versionId?: string; packageId?: string },
): boolean {
  if (!killSwitch.active) return false;
  if (killSwitch.scope === 'TENANT') return true;
  if (killSwitch.scope === 'VERSION') return Boolean(input.versionId && killSwitch.versionId === input.versionId);
  if (killSwitch.scope === 'RULESET') return Boolean(input.packageId && killSwitch.packageId === input.packageId);
  return false;
}

function summarizeKillState(
  activeSwitches: ReadonlyArray<{
    scope: KillScope;
    reason?: string;
  }>,
  versionKill?: { active: boolean; reason?: string },
): RuntimeKillState {
  const sources: RuntimeKillSource[] = activeSwitches.map((killSwitch) => ({
    scope: killSwitch.scope,
    reason: killSwitch.reason,
  }));
  if (versionKill?.active) {
    sources.push({
      scope: 'VERSION',
      reason: versionKill.reason,
    });
  }
  const reason =
    sources.find((source) => typeof source.reason === 'string' && source.reason.trim().length > 0)?.reason ??
    undefined;
  return {
    active: sources.length > 0,
    reason,
    sources,
  };
}

async function resolveRuntimeKillState(input: {
  versionId?: string;
  packageId?: string;
}): Promise<RuntimeKillState> {
  if (providerMode() !== 'postgres') {
    return {
      active: false,
      sources: [],
    };
  }

  const session = toRepoSession();
  const repo = await getPostgresRepo();
  const killSwitches = await repo.listKillSwitches({ tenantId: session.tenantId });
  const activeSwitches = killSwitches.filter((killSwitch) =>
    killSwitchMatchesVersion(killSwitch, input),
  );

  let versionKill: { active: boolean; reason?: string } | undefined;
  if (input.versionId) {
    const version = await repo.getConfigVersion(session.tenantId, input.versionId);
    if (version?.isKilled) {
      versionKill = {
        active: true,
        reason: version.killReason,
      };
    }
  }

  return summarizeKillState(activeSwitches, versionKill);
}

async function assertVersionNotKilled(input: {
  versionId: string;
  packageId?: string;
  knownReason?: string;
}): Promise<null | ReturnType<typeof versionKilledFailure>> {
  const killState = await resolveRuntimeKillState({
    versionId: input.versionId,
    packageId: input.packageId,
  });
  if (!killState.active) return null;
  return versionKilledFailure(killState.reason ?? input.knownReason);
}

function slugId(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'config';
}

function nextVersionLabel(previous: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(previous.trim());
  if (!match) return `${previous}-next`;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;
  return `${major}.${minor}.${patch}`;
}

function jsonDiff(before: unknown, after: unknown, path = 'root'): JsonDiffItem[] {
  if (Object.is(before, after)) return [];
  const beforeObj = typeof before === 'object' && before !== null;
  const afterObj = typeof after === 'object' && after !== null;
  if (!beforeObj || !afterObj) {
    return [{ path, before, after }];
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after)) {
      return [{ path, before, after }];
    }
    const max = Math.max(before.length, after.length);
    const out: JsonDiffItem[] = [];
    for (let index = 0; index < max; index += 1) {
      out.push(...jsonDiff(before[index], after[index], `${path}[${index}]`));
    }
    return out;
  }
  const out: JsonDiffItem[] = [];
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  for (const key of keys) {
    out.push(...jsonDiff(beforeRecord[key], afterRecord[key], path === 'root' ? key : `${path}.${key}`));
  }
  return out;
}

function defaultBundle(): ConfigBundle {
  const uiSchema = JSON.parse(JSON.stringify(exampleUi)) as ConfigBundle['uiSchema'];
  const flowSchema = JSON.parse(JSON.stringify(exampleFlow)) as ConfigBundle['flowSchema'];
  const rules = JSON.parse(JSON.stringify(exampleRules)) as ConfigBundle['rules'];
  const apiMappingsById = {
    submitOrder: JSON.parse(JSON.stringify(exampleApi)) as ConfigBundle['apiMappingsById'][string],
  };

  if (!uiSchema) {
    throw new Error('example ui schema is missing');
  }

  return {
    ...createSinglePageBundle({
      uiSchema,
      flowSchema,
      rules,
      apiMappingsById,
    }),
  };
}

export class RepositoryUnavailableError extends Error {}

export function isPersistenceError(error: unknown): boolean {
  return error instanceof RepositoryUnavailableError || demo.isPersistenceError(error);
}

export async function getConfigStore(): Promise<unknown> {
  if (providerMode() === 'postgres') {
    await getPostgresRepo();
    return { provider: 'postgres' as const };
  }
  return await demo.getConfigStore();
}

export async function getStoreDiagnostics(): Promise<{
  provider: string;
  baseDir: string | null;
  canWriteToStore: boolean;
  warning?: string;
}> {
  if (providerMode() === 'postgres') {
    return {
      provider: 'postgres',
      baseDir: null,
      canWriteToStore: true,
    };
  }
  return await demo.getStoreDiagnostics();
}

export async function getConsoleSnapshot(): Promise<ConsoleSnapshot> {
  if (providerMode() === 'postgres') {
    const session = toRepoSession();
    const repo = await getPostgresRepo();
    const snapshot = await repo.getConsoleSnapshot(session.tenantId);
    return {
      tenantId: snapshot.tenantId,
      packages: snapshot.packages.map((pkg) => ({
        id: pkg.id,
        tenantId: pkg.tenantId,
        configId: pkg.configId,
        name: pkg.name,
        description: pkg.description,
        createdAt: pkg.createdAt,
        createdBy: pkg.createdBy,
        versions: snapshot.versions
          .filter((version) => version.packageId === pkg.id)
          .map((version) => ({
            id: version.id,
            packageId: version.packageId,
            version: version.version,
            status: version.status,
            createdAt: version.createdAt,
            createdBy: version.createdBy,
            updatedAt: version.updatedAt,
            updatedBy: version.updatedBy,
            bundle: version.bundle as ConfigBundle,
            isKilled: version.isKilled,
            killReason: version.killReason,
          })),
      })),
      versions: snapshot.versions.map((version) => ({
        id: version.id,
        packageId: version.packageId,
        version: version.version,
        status: version.status,
        createdAt: version.createdAt,
        createdBy: version.createdBy,
        updatedAt: version.updatedAt,
        updatedBy: version.updatedBy,
        bundle: version.bundle as ConfigBundle,
        isKilled: version.isKilled,
        killReason: version.killReason,
      })),
      approvals: snapshot.approvals.map((approval) => ({
        id: approval.id,
        versionId: approval.versionId,
        packageId: approval.packageId,
        requestedBy: approval.requestedBy,
        requestedAt: approval.requestedAt,
        scope: approval.scope,
        risk: approval.risk,
        status: approval.status,
        decidedBy: approval.decidedBy,
        decidedAt: approval.decidedAt,
        notes: approval.notes,
      })),
      audit: snapshot.audit.map((event) => ({
        id: event.id,
        at: event.at,
        actor: event.actor,
        action: event.action,
        target: event.target,
        severity: event.severity,
        metadata: event.metadata,
      })),
    };
  }
  return await demo.getConsoleSnapshot();
}

export async function getConfigVersion(versionId: string): Promise<ConfigVersion | null> {
  if (providerMode() === 'postgres') {
    const session = toRepoSession();
    const repo = await getPostgresRepo();
    const version = await repo.getConfigVersion(session.tenantId, versionId);
    if (!version) return null;
    const disabled = await repo.isVersionKilled({
      tenantId: session.tenantId,
      versionId: version.id,
      packageId: version.packageId,
    });
    return {
      id: version.id,
      packageId: version.packageId,
      version: version.version,
      status: version.status,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      updatedAt: version.updatedAt,
      updatedBy: version.updatedBy,
      bundle: version.bundle as ConfigBundle,
      isKilled: disabled || version.isKilled,
      killReason: version.killReason,
    };
  }
  return await demo.getConfigVersion(versionId);
}

export async function createConfigPackage(input: {
  name: string;
  description?: string;
  templateId?: Parameters<typeof demo.createConfigPackage>[0]['templateId'];
  tenantId?: string;
  configId?: string;
}) {
  const checks = await evaluatePolicyStage({
    stage: 'save',
    requiredRole: 'Author',
    nextBundle: defaultBundle(),
  });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    const packageId = slugId(input.configId ?? input.name);
    const versionId = `ver-${crypto.randomUUID()}`;
    await repo.createConfigPackage({
      session: toRepoSession(),
      packageId,
      configId: packageId,
      name: input.name,
      description: input.description,
      versionId,
      versionLabel: '0.1.0',
      bundle: defaultBundle() as unknown as JsonRecord,
    });
    return { packageId, versionId };
  }
  return await demo.createConfigPackage(input);
}

export async function createConfigVersion(input: { packageId: string; fromVersionId?: string }) {
  const base = input.fromVersionId ? await getConfigVersion(input.fromVersionId) : null;
  const checks = await evaluatePolicyStage({
    stage: 'save',
    requiredRole: 'Author',
    currentBundle: base?.bundle,
    nextBundle: base?.bundle ?? defaultBundle(),
  });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    const versionId = `ver-${crypto.randomUUID()}`;
    const versionLabel = base ? nextVersionLabel(base.version) : '0.1.0';
    await repo.createConfigVersion({
      session: toRepoSession(),
      packageId: input.packageId,
      versionId,
      versionLabel,
      bundle: (base?.bundle ?? defaultBundle()) as unknown as JsonRecord,
    });
    return { ok: true as const, versionId };
  }
  return { ok: false as const, error: 'Create version requires Postgres provider' };
}

export async function updateUiSchema(input: {
  versionId: string;
  uiSchema?: ConfigBundle['uiSchema'];
  uiSchemasById?: ConfigBundle['uiSchemasById'];
  activeUiPageId?: ConfigBundle['activeUiPageId'];
  flowSchema?: ConfigBundle['flowSchema'];
}) {
  const hasUiUpdate =
    Boolean(input.uiSchema) ||
    (Boolean(input.uiSchemasById) && Object.keys(input.uiSchemasById ?? {}).length > 0);
  if (!hasUiUpdate) {
    return { ok: false as const, error: 'uiSchema or uiSchemasById is required' };
  }

  const baseVersion = await getConfigVersion(input.versionId);
  if (!baseVersion) {
    return { ok: false as const, error: 'Version not found' };
  }
  const killBlocked = await assertVersionNotKilled({
    versionId: input.versionId,
    packageId: baseVersion.packageId,
    knownReason: baseVersion.killReason,
  });
  if (killBlocked) {
    return killBlocked;
  }
  const nextBundle = baseVersion
    ? applyUiPageUpdateToBundle(baseVersion.bundle, {
        uiSchema: input.uiSchema,
        uiSchemasById: input.uiSchemasById,
        activeUiPageId: input.activeUiPageId,
        flowSchema: input.flowSchema,
      })
    : undefined;
  const checks = await evaluatePolicyStage({
    stage: 'save',
    requiredRole: 'Author',
    currentBundle: baseVersion?.bundle,
    nextBundle,
  });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return await repo.updateVersionBundle({
      session: toRepoSession(),
      versionId: input.versionId,
      action: 'Updated UI schema',
      mutate: (bundle) =>
        applyUiPageUpdateToBundle(bundle as ConfigBundle, {
          uiSchema: input.uiSchema,
          uiSchemasById: input.uiSchemasById,
          activeUiPageId: input.activeUiPageId,
          flowSchema: input.flowSchema,
        }) as unknown as JsonRecord,
    });
  }
  return await demo.updateUiSchema(input);
}

export async function updateRules(input: { versionId: string; rules: ConfigBundle['rules'] }) {
  const baseVersion = await getConfigVersion(input.versionId);
  if (!baseVersion) {
    return { ok: false as const, error: 'Version not found' };
  }
  const killBlocked = await assertVersionNotKilled({
    versionId: input.versionId,
    packageId: baseVersion.packageId,
    knownReason: baseVersion.killReason,
  });
  if (killBlocked) {
    return killBlocked;
  }
  const checks = await evaluatePolicyStage({
    stage: 'save',
    requiredRole: 'Author',
    currentBundle: baseVersion.bundle,
    nextBundle: { ...baseVersion.bundle, rules: input.rules },
  });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return await repo.updateVersionBundle({
      session: toRepoSession(),
      versionId: input.versionId,
      action: 'Updated rule set',
      mutate: (bundle) => ({ ...bundle, rules: input.rules }),
    });
  }
  return await demo.updateRules(input);
}

export async function updateFlowSchema(input: {
  versionId: string;
  flowSchema: ConfigBundle['flowSchema'];
}) {
  const baseVersion = await getConfigVersion(input.versionId);
  if (!baseVersion) {
    return { ok: false as const, error: 'Version not found' };
  }
  const killBlocked = await assertVersionNotKilled({
    versionId: input.versionId,
    packageId: baseVersion.packageId,
    knownReason: baseVersion.killReason,
  });
  if (killBlocked) {
    return killBlocked;
  }
  const checks = await evaluatePolicyStage({
    stage: 'save',
    requiredRole: 'Author',
    currentBundle: baseVersion.bundle,
    nextBundle: { ...baseVersion.bundle, flowSchema: input.flowSchema },
  });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return await repo.updateVersionBundle({
      session: toRepoSession(),
      versionId: input.versionId,
      action: 'Updated flow schema',
      mutate: (bundle) => ({ ...bundle, flowSchema: input.flowSchema }),
    });
  }
  return await demo.updateFlowSchema(input);
}

export async function updateApiMappings(input: {
  versionId: string;
  apiMappingsById: ConfigBundle['apiMappingsById'];
}) {
  const baseVersion = await getConfigVersion(input.versionId);
  if (!baseVersion) {
    return { ok: false as const, error: 'Version not found' };
  }
  const killBlocked = await assertVersionNotKilled({
    versionId: input.versionId,
    packageId: baseVersion.packageId,
    knownReason: baseVersion.killReason,
  });
  if (killBlocked) {
    return killBlocked;
  }
  const checks = await evaluatePolicyStage({
    stage: 'save',
    requiredRole: 'Author',
    currentBundle: baseVersion.bundle,
    nextBundle: { ...baseVersion.bundle, apiMappingsById: input.apiMappingsById },
  });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return await repo.updateVersionBundle({
      session: toRepoSession(),
      versionId: input.versionId,
      action: 'Updated API mappings',
      mutate: (bundle) => ({ ...bundle, apiMappingsById: input.apiMappingsById }),
    });
  }
  return await demo.updateApiMappings(input);
}

export async function submitForReview(input: { versionId: string; scope: string; risk: RiskLevel }) {
  const version = await getConfigVersion(input.versionId);
  if (!version) return { ok: false as const, error: 'Version not found' };
  const killBlocked = await assertVersionNotKilled({
    versionId: input.versionId,
    packageId: version.packageId,
    knownReason: version.killReason,
  });
  if (killBlocked) {
    return killBlocked;
  }
  const checks = await evaluatePolicyStage({
    stage: 'submit-for-review',
    requiredRole: 'Author',
    currentBundle: version.bundle,
  });
  if (checks.length > 0) return policyFailure(checks);
  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return await repo.submitForReview({
      session: toRepoSession(),
      versionId: input.versionId,
      scope: input.scope,
      risk: input.risk,
    });
  }
  return await demo.submitForReview(input);
}

export async function approveRequest(input: { approvalId: string }) {
  const checks = await evaluatePolicyStage({ stage: 'approve', requiredRole: 'Approver' });
  if (checks.length > 0) return policyFailure(checks);
  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return await repo.approveReview({ session: toRepoSession(), approvalId: input.approvalId });
  }
  return await demo.approveRequest(input);
}

export async function requestChanges(input: { approvalId: string; notes?: string }) {
  const checks = await evaluatePolicyStage({ stage: 'approve', requiredRole: 'Approver' });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return await repo.requestReviewChanges({
      session: toRepoSession(),
      approvalId: input.approvalId,
      notes: input.notes,
    });
  }
  return await demo.requestChanges(input);
}

export async function promoteVersion(input: { versionId: string }) {
  const version = await getConfigVersion(input.versionId);
  if (!version) return { ok: false as const, error: 'Version not found' };
  const killBlocked = await assertVersionNotKilled({
    versionId: input.versionId,
    packageId: version.packageId,
    knownReason: version.killReason,
  });
  if (killBlocked) {
    return killBlocked;
  }

  const checks = await evaluatePolicyStage({
    stage: 'promote',
    requiredRole: 'Publisher',
    currentBundle: version.bundle,
  });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return await repo.promoteVersion({ session: toRepoSession(), versionId: input.versionId });
  }
  return await demo.promoteVersion(input);
}

export async function rollbackVersion(input: { versionId: string }) {
  const version = await getConfigVersion(input.versionId);
  if (!version) return { ok: false as const, error: 'Version not found' };
  const killBlocked = await assertVersionNotKilled({
    versionId: input.versionId,
    packageId: version.packageId,
    knownReason: version.killReason,
  });
  if (killBlocked) {
    return killBlocked;
  }

  const checks = await evaluatePolicyStage({
    stage: 'promote',
    requiredRole: 'Publisher',
    currentBundle: version.bundle,
  });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return await repo.rollbackVersion({ session: toRepoSession(), versionId: input.versionId });
  }
  return { ok: false as const, error: 'Rollback requires Postgres provider' };
}

export async function diffVersion(input: { versionId: string; againstVersionId?: string | null }) {
  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    const result = await repo.getVersionDiffSource({
      tenantId: toRepoSession().tenantId,
      versionId: input.versionId,
      againstVersionId: input.againstVersionId,
    });
    if (!result.ok) return result;

    const before = result.before.bundle as ConfigBundle;
    const after = result.after.bundle as ConfigBundle;
    const rawDiff = jsonDiff(before, after);
    const beforeUi = JSON.stringify({
      uiSchemasById: before.uiSchemasById ?? null,
      activeUiPageId: before.activeUiPageId ?? null,
      uiSchema: before.uiSchema ?? null,
    });
    const afterUi = JSON.stringify({
      uiSchemasById: after.uiSchemasById ?? null,
      activeUiPageId: after.activeUiPageId ?? null,
      uiSchema: after.uiSchema ?? null,
    });
    const semantic = {
      uiChanged: beforeUi !== afterUi,
      flowChanged: JSON.stringify(before.flowSchema) !== JSON.stringify(after.flowSchema),
      rulesChanged: JSON.stringify(before.rules) !== JSON.stringify(after.rules),
      apiChanged: JSON.stringify(before.apiMappingsById) !== JSON.stringify(after.apiMappingsById),
    };
    return {
      ok: true as const,
      packageId: result.packageId,
      before: { id: result.before.id, version: result.before.version },
      after: { id: result.after.id, version: result.after.version },
      diffs: rawDiff,
      semantic,
    };
  }
  return await demo.diffVersion(input);
}

export async function exportGitOpsBundle(): Promise<GitOpsBundle> {
  if (providerMode() === 'postgres') {
    const session = toRepoSession();
    const repo = await getPostgresRepo();
    const payload = await repo.exportTenantBundle({ tenantId: session.tenantId });
    const exportPayload = buildGitOpsBundlePayloadFromPostgres(payload);
    const signatureValue = Buffer.from(
      crypto
        .createHash('sha256')
        .update(JSON.stringify(exportPayload), 'utf8')
        .digest('hex'),
      'utf8',
    ).toString('base64');
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      tenantId: session.tenantId,
      payload: exportPayload,
      signature: {
        alg: 'HMAC-SHA256',
        keyId: 'sha256',
        value: signatureValue,
      },
    };
  }
  return await demo.exportGitOpsBundle();
}

export async function importGitOpsBundle(input: { bundle: GitOpsBundle }) {
  const checks = await evaluatePolicyStage({ stage: 'promote', requiredRole: 'Publisher' });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const session = toRepoSession();
    const repo = await getPostgresRepo();
    const normalized = normalizeGitOpsBundleForPostgres(input.bundle, session.tenantId);
    if (!normalized.ok) {
      return { ok: false as const, error: normalized.error };
    }

    const parsed: GitOpsPayload = normalized.payload;
    await repo.importTenantBundle({ session, payload: parsed });
    return { ok: true as const };
  }
  return await demo.importGitOpsBundle(input);
}

export async function listFeatureFlags(input: { env?: string }) {
  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return { ok: true as const, flags: await repo.listFeatureFlags({ tenantId: toRepoSession().tenantId, env: input.env }) };
  }
  return { ok: true as const, flags: [] };
}

export async function upsertFeatureFlag(input: { env: string; key: string; enabled: boolean; value?: JsonRecord }) {
  const checks = await evaluatePolicyStage({ stage: 'promote', requiredRole: 'Publisher' });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return { ok: true as const, flag: await repo.upsertFeatureFlag({ session: toRepoSession(), ...input }) };
  }
  return { ok: false as const, error: 'Feature flags require Postgres provider' };
}

export async function listKillSwitches() {
  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return { ok: true as const, killSwitches: await repo.listKillSwitches({ tenantId: toRepoSession().tenantId }) };
  }
  return { ok: true as const, killSwitches: [] };
}

export async function getRuntimeFlags(input?: {
  env?: string;
  versionId?: string;
  packageId?: string;
}) {
  const env = input?.env?.trim() || 'prod';
  const tenantId = toRepoSession().tenantId;
  const featureFlagResult = await listFeatureFlags({ env });
  const featureFlags = toFeatureFlagMap(featureFlagResult.flags);

  const killSwitch = await resolveRuntimeKillState({
    versionId: input?.versionId,
    packageId: input?.packageId,
  });

  return {
    ok: true as const,
    tenantId,
    env,
    featureFlags,
    killSwitch,
  };
}

export async function upsertKillSwitch(input: {
  scope: KillScope;
  active: boolean;
  packageId?: string;
  versionId?: string;
  rulesetKey?: string;
  reason?: string;
}) {
  const checks = await evaluatePolicyStage({ stage: 'promote', requiredRole: 'Publisher' });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return { ok: true as const, killSwitch: await repo.upsertKillSwitch({ session: toRepoSession(), ...input }) };
  }
  return { ok: false as const, error: 'Kill switch requires Postgres provider' };
}

export async function getBranding() {
  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return { ok: true as const, branding: await repo.getBranding(toRepoSession().tenantId) };
  }
  return { ok: true as const, branding: null };
}

export async function upsertBranding(input: {
  logoUrl?: string;
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  secondaryColor: string;
  typographyScale: number;
  radius: number;
  spacing: number;
  cssVariables: Record<string, unknown>;
}) {
  const checks = await evaluatePolicyStage({ stage: 'promote', requiredRole: 'Publisher' });
  if (checks.length > 0) return policyFailure(checks);

  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return { ok: true as const, branding: await repo.upsertBranding({ session: toRepoSession(), branding: input }) };
  }
  return { ok: false as const, error: 'Branding requires Postgres provider' };
}

export async function listExecutionTraces(input?: { limit?: number }) {
  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    return { ok: true as const, traces: await repo.listExecutionTraces({ tenantId: toRepoSession().tenantId, limit: input?.limit }) };
  }
  return { ok: true as const, traces: [] };
}

export async function recordExecutionTrace(input: {
  executionId: string;
  correlationId: string;
  packageId?: string;
  versionId?: string;
  trace: JsonRecord;
  coldStorageUri?: string;
}) {
  if (providerMode() === 'postgres') {
    const repo = await getPostgresRepo();
    recordRuntimeTrace(input.trace);
    return { ok: true as const, trace: await repo.addExecutionTrace({ tenantId: toRepoSession().tenantId, ...input }) };
  }
  recordRuntimeTrace(input.trace);
  return { ok: true as const };
}

export async function resetDemoStore() {
  if (providerMode() === 'postgres') {
    return { ok: true as const };
  }
  return await demo.resetDemoStore();
}

export async function createConfigStoreForTests(...args: Parameters<typeof demo.createConfigStoreForTests>) {
  return await demo.createConfigStoreForTests(...args);
}

export function resetConfigStoreManagerForTests() {
  demo.resetConfigStoreManagerForTests();
}

export async function getComponentRegistrySnapshot(
  input?: Parameters<typeof demo.getComponentRegistrySnapshot>[0],
) {
  return await demo.getComponentRegistrySnapshot(input);
}

export async function registerComponentRegistryManifest(
  input: Parameters<typeof demo.registerComponentRegistryManifest>[0],
) {
  return await demo.registerComponentRegistryManifest(input);
}

export async function getTranslationsSnapshot(
  input?: Parameters<typeof demo.getTranslationsSnapshot>[0],
) {
  // Translation editor currently uses demo persistence for both providers until
  // tenant-level translation storage is added to Postgres repository surfaces.
  return await demo.getTranslationsSnapshot(input);
}

export async function upsertTranslationMessage(
  input: Parameters<typeof demo.upsertTranslationMessage>[0],
) {
  return await demo.upsertTranslationMessage(input);
}

export async function updateTranslationPreferences(
  input: Parameters<typeof demo.updateTranslationPreferences>[0],
) {
  return await demo.updateTranslationPreferences(input);
}

export { listPolicies, registerPolicy, unregisterPolicy };
