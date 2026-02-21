import type {
  ApprovalStatus,
  AuditSeverity,
  ConfigStatus,
  GitOpsPayload,
  JsonRecord,
  KillScope,
  RiskLevel,
} from '@platform/persistence-postgres';
import type {
  ApprovalRequest,
  AuditEvent,
  ConfigPackage,
  ConfigStatus as UiConfigStatus,
  ConfigVersion,
  GitOpsBundle,
} from '@/lib/demo/types';

type NormalizeGitOpsResult =
  | { ok: true; payload: GitOpsPayload }
  | { ok: false; error: string };

const CONFIG_STATUSES = new Set<ConfigStatus>([
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'ACTIVE',
  'DEPRECATED',
  'RETIRED',
]);

const APPROVAL_STATUSES = new Set<ApprovalStatus>(['PENDING', 'APPROVED', 'CHANGES_REQUESTED']);
const RISK_LEVELS = new Set<RiskLevel>(['Low', 'Medium', 'High']);
const AUDIT_SEVERITIES = new Set<AuditSeverity>(['info', 'warning', 'error']);
const KILL_SCOPES = new Set<KillScope>(['TENANT', 'RULESET', 'VERSION', 'COMPONENT']);

export function normalizeGitOpsBundleForPostgres(
  bundle: GitOpsBundle,
  tenantId: string,
): NormalizeGitOpsResult {
  if (!isRecord(bundle.payload)) {
    return { ok: false, error: 'GitOps bundle payload is missing or invalid' };
  }

  const packagesRaw = bundle.payload.packages;
  if (!Array.isArray(packagesRaw)) {
    return { ok: false, error: 'GitOps bundle payload.packages must be an array' };
  }

  const packages = packagesRaw.map((pkg) => mapPackage(pkg, tenantId));
  const packageIds = new Set(packages.map((pkg) => pkg.id));

  const versionsRaw =
    Array.isArray(bundle.payload.versions) && bundle.payload.versions.length > 0
      ? bundle.payload.versions
      : packagesRaw.flatMap((pkg) => (Array.isArray(pkg.versions) ? pkg.versions : []));

  const versions = versionsRaw.map((version) => mapVersion(version, tenantId));
  for (const version of versions) {
    if (!packageIds.has(version.packageId)) {
      return {
        ok: false,
        error: `Version ${version.id} references unknown package ${version.packageId}`,
      };
    }
  }

  const approvalsRaw = Array.isArray(bundle.payload.approvals) ? bundle.payload.approvals : [];
  const approvals = approvalsRaw.map((approval, index) => mapApproval(approval, tenantId, index));
  const versionIds = new Set(versions.map((version) => version.id));
  for (const approval of approvals) {
    if (!packageIds.has(approval.packageId)) {
      return {
        ok: false,
        error: `Approval ${approval.id} references unknown package ${approval.packageId}`,
      };
    }
    if (!versionIds.has(approval.versionId)) {
      return {
        ok: false,
        error: `Approval ${approval.id} references unknown version ${approval.versionId}`,
      };
    }
  }

  const auditRaw = Array.isArray(bundle.payload.audit) ? bundle.payload.audit : [];
  const audit = auditRaw.map((event, index) => mapAuditEvent(event, tenantId, index));

  const featureFlagsRaw = Array.isArray(bundle.payload.featureFlags) ? bundle.payload.featureFlags : [];
  const featureFlags = featureFlagsRaw.map((flag, index) => ({
    id: fallbackString(flag.id, `flag-import-${index + 1}`),
    tenantId,
    env: fallbackString(flag.env, 'prod'),
    key: fallbackString(flag.key, `flag-${index + 1}`),
    enabled: Boolean(flag.enabled),
    value: toJsonRecord(flag.value),
    updatedBy: optionalString(flag.updatedBy),
    updatedAt: fallbackString(flag.updatedAt, bundle.exportedAt),
  }));

  const killSwitchesRaw = Array.isArray(bundle.payload.killSwitches) ? bundle.payload.killSwitches : [];
  const killSwitches = killSwitchesRaw.map((killSwitch, index) => ({
    id: fallbackString(killSwitch.id, `kill-import-${index + 1}`),
    tenantId,
    scope: toKillScope(killSwitch.scope),
    packageId: optionalString(killSwitch.packageId),
    versionId: optionalString(killSwitch.versionId),
    componentId: optionalString(killSwitch.componentId),
    rulesetKey: optionalString(killSwitch.rulesetKey ?? killSwitch.componentId),
    active: Boolean(killSwitch.active),
    reason: optionalString(killSwitch.reason),
    updatedBy: optionalString(killSwitch.updatedBy),
    updatedAt: fallbackString(killSwitch.updatedAt, bundle.exportedAt),
  }));

  const brandingRaw = bundle.payload.branding;
  const branding = brandingRaw
    ? {
        tenantId,
        logoUrl: optionalString(brandingRaw.logoUrl),
        mode:
          brandingRaw.mode === 'dark' || brandingRaw.mode === 'system' ? brandingRaw.mode : ('light' as const),
        primaryColor: fallbackString(brandingRaw.primaryColor, '#0055aa'),
        secondaryColor: fallbackString(brandingRaw.secondaryColor, '#0b2a44'),
        typographyScale: toFiniteNumber(brandingRaw.typographyScale, 1),
        radius: toFiniteNumber(brandingRaw.radius, 8),
        spacing: toFiniteNumber(brandingRaw.spacing, 8),
        cssVariables: toJsonRecord(brandingRaw.cssVariables),
        updatedBy: optionalString(brandingRaw.updatedBy),
        updatedAt: fallbackString(brandingRaw.updatedAt, bundle.exportedAt),
      }
    : undefined;

  return {
    ok: true,
    payload: {
      packages,
      versions,
      approvals,
      audit,
      featureFlags,
      killSwitches,
      branding,
    },
  };
}

export function buildGitOpsBundlePayloadFromPostgres(payload: GitOpsPayload): GitOpsBundle['payload'] {
  const versionsByPackage = new Map<string, ConfigVersion[]>();
  for (const version of payload.versions) {
    const mapped = mapUiVersion(version);
    const list = versionsByPackage.get(version.packageId);
    if (list) {
      list.push(mapped);
    } else {
      versionsByPackage.set(version.packageId, [mapped]);
    }
  }

  const packages: ConfigPackage[] = payload.packages.map((pkg) => ({
    id: pkg.id,
    tenantId: pkg.tenantId,
    configId: pkg.configId,
    name: pkg.name,
    description: pkg.description,
    createdAt: pkg.createdAt,
    createdBy: pkg.createdBy,
    versions: versionsByPackage.get(pkg.id) ?? [],
  }));

  const versions: ConfigVersion[] = payload.versions.map(mapUiVersion);
  const approvals: ApprovalRequest[] = payload.approvals.map((approval) => ({
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
  }));

  const audit: AuditEvent[] = payload.audit.map((event) => ({
    id: event.id,
    at: event.at,
    actor: event.actor,
    action: event.action,
    target: event.target,
    severity: event.severity,
    metadata: event.metadata,
  }));

  return {
    packages,
    versions,
    approvals,
    audit,
    featureFlags: payload.featureFlags.map((flag) => ({
      id: flag.id,
      tenantId: flag.tenantId,
      env: flag.env,
      key: flag.key,
      enabled: flag.enabled,
      value: flag.value,
      updatedBy: flag.updatedBy,
      updatedAt: flag.updatedAt,
    })),
    killSwitches: payload.killSwitches.map((killSwitch) => ({
      id: killSwitch.id,
      tenantId: killSwitch.tenantId,
      scope: killSwitch.scope,
      packageId: killSwitch.packageId,
      versionId: killSwitch.versionId,
      componentId: killSwitch.componentId,
      rulesetKey: killSwitch.rulesetKey,
      active: killSwitch.active,
      reason: killSwitch.reason,
      updatedBy: killSwitch.updatedBy,
      updatedAt: killSwitch.updatedAt,
    })),
    branding: payload.branding
      ? {
          tenantId: payload.branding.tenantId,
          logoUrl: payload.branding.logoUrl,
          mode: payload.branding.mode,
          primaryColor: payload.branding.primaryColor,
          secondaryColor: payload.branding.secondaryColor,
          typographyScale: payload.branding.typographyScale,
          radius: payload.branding.radius,
          spacing: payload.branding.spacing,
          cssVariables: payload.branding.cssVariables,
          updatedBy: payload.branding.updatedBy,
          updatedAt: payload.branding.updatedAt,
        }
      : undefined,
  };
}

function mapPackage(pkg: ConfigPackage, tenantId: string) {
  return {
    id: pkg.id,
    tenantId,
    configId: pkg.configId,
    name: pkg.name,
    description: pkg.description,
    createdBy: pkg.createdBy,
    createdAt: pkg.createdAt,
  };
}

function mapVersion(version: ConfigVersion, tenantId: string) {
  const rec = version as ConfigVersion & {
    isKilled?: unknown;
    killReason?: unknown;
  };
  return {
    id: version.id,
    tenantId,
    packageId: version.packageId,
    version: version.version,
    status: toConfigStatus(version.status),
    bundle: toJsonRecord(version.bundle),
    createdBy: version.createdBy,
    createdAt: version.createdAt,
    updatedBy: version.updatedBy,
    updatedAt: version.updatedAt,
    isKilled: typeof rec.isKilled === 'boolean' ? rec.isKilled : false,
    killReason: optionalString(rec.killReason),
  };
}

function mapUiVersion(version: GitOpsPayload['versions'][number]): ConfigVersion {
  return {
    id: version.id,
    packageId: version.packageId,
    version: version.version,
    status: toUiConfigStatus(version.status),
    bundle: version.bundle as ConfigVersion['bundle'],
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    updatedAt: version.updatedAt,
    updatedBy: version.updatedBy,
    isKilled: version.isKilled,
    killReason: version.killReason,
  };
}

function mapApproval(approval: ApprovalRequest, tenantId: string, index: number) {
  return {
    id: fallbackString(approval.id, `approval-import-${index + 1}`),
    tenantId,
    packageId: approval.packageId,
    versionId: approval.versionId,
    requestedBy: fallbackString(approval.requestedBy, 'import'),
    requestedAt: fallbackString(approval.requestedAt, new Date().toISOString()),
    scope: fallbackString(approval.scope, 'Imported approval'),
    risk: toRisk(approval.risk),
    status: toApprovalStatus(approval.status),
    decidedBy: approval.decidedBy,
    decidedAt: approval.decidedAt,
    notes: approval.notes,
  };
}

function mapAuditEvent(event: AuditEvent, tenantId: string, index: number) {
  return {
    id: fallbackString(event.id, `audit-import-${index + 1}`),
    tenantId,
    actor: fallbackString(event.actor, 'import'),
    action: fallbackString(event.action, 'Imported event'),
    target: fallbackString(event.target, 'tenant'),
    severity: toAuditSeverity(event.severity),
    metadata: toJsonRecord(event.metadata),
    at: fallbackString(event.at, new Date().toISOString()),
  };
}

function toConfigStatus(value: unknown): ConfigStatus {
  if (typeof value === 'string' && CONFIG_STATUSES.has(value as ConfigStatus)) {
    return value as ConfigStatus;
  }
  return 'DRAFT';
}

function toUiConfigStatus(value: unknown): UiConfigStatus {
  if (typeof value === 'string' && CONFIG_STATUSES.has(value as ConfigStatus)) {
    return value as UiConfigStatus;
  }
  return 'DRAFT';
}

function toApprovalStatus(value: unknown): ApprovalStatus {
  if (typeof value === 'string' && APPROVAL_STATUSES.has(value as ApprovalStatus)) {
    return value as ApprovalStatus;
  }
  return 'PENDING';
}

function toRisk(value: unknown): RiskLevel {
  if (typeof value === 'string' && RISK_LEVELS.has(value as RiskLevel)) {
    return value as RiskLevel;
  }
  return 'Low';
}

function toAuditSeverity(value: unknown): AuditSeverity {
  if (typeof value === 'string' && AUDIT_SEVERITIES.has(value as AuditSeverity)) {
    return value as AuditSeverity;
  }
  return 'info';
}

function toKillScope(value: unknown): KillScope {
  if (typeof value === 'string' && KILL_SCOPES.has(value as KillScope)) {
    return value as KillScope;
  }
  return 'TENANT';
}

function fallbackString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return fallback;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return undefined;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toJsonRecord(value: unknown): JsonRecord {
  if (isRecord(value)) {
    return value as JsonRecord;
  }
  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
