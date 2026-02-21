export type ConfigStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'DEPRECATED'
  | 'RETIRED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type AuditSeverity = 'info' | 'warning' | 'error';
export type KillScope = 'TENANT' | 'RULESET' | 'VERSION' | 'COMPONENT';

export type JsonRecord = Record<string, unknown>;

export interface RepoSession {
  tenantId: string;
  userId: string;
  userName: string;
  roles: string[];
}

export interface RepoConfigPackage {
  id: string;
  tenantId: string;
  configId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export interface RepoConfigVersion {
  id: string;
  tenantId: string;
  packageId: string;
  version: string;
  status: ConfigStatus;
  bundle: JsonRecord;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  isKilled: boolean;
  killReason?: string;
}

export interface RepoApproval {
  id: string;
  tenantId: string;
  packageId: string;
  versionId: string;
  requestedBy: string;
  requestedAt: string;
  scope: string;
  risk: RiskLevel;
  status: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  notes?: string;
}

export interface RepoAuditEvent {
  id: string;
  tenantId: string;
  actor: string;
  action: string;
  target: string;
  severity: AuditSeverity;
  metadata?: JsonRecord;
  at: string;
}

export interface RepoFeatureFlag {
  id: string;
  tenantId: string;
  env: string;
  key: string;
  enabled: boolean;
  value: JsonRecord;
  updatedBy?: string;
  updatedAt: string;
}

export interface RepoKillSwitch {
  id: string;
  tenantId: string;
  scope: KillScope;
  packageId?: string;
  versionId?: string;
  componentId?: string;
  rulesetKey?: string;
  active: boolean;
  reason?: string;
  updatedBy?: string;
  updatedAt: string;
}

export interface RepoBranding {
  tenantId: string;
  logoUrl?: string;
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  secondaryColor: string;
  typographyScale: number;
  radius: number;
  spacing: number;
  cssVariables: JsonRecord;
  updatedBy?: string;
  updatedAt: string;
}

export interface RepoExecutionTrace {
  id: string;
  tenantId: string;
  executionId: string;
  correlationId: string;
  packageId?: string;
  versionId?: string;
  trace: JsonRecord;
  coldStorageUri?: string;
  createdAt: string;
}

export interface RepoConsoleSnapshot {
  tenantId: string;
  packages: RepoConfigPackage[];
  versions: RepoConfigVersion[];
  approvals: RepoApproval[];
  audit: RepoAuditEvent[];
}

export interface GitOpsPayload {
  packages: RepoConfigPackage[];
  versions: RepoConfigVersion[];
  approvals: RepoApproval[];
  audit: RepoAuditEvent[];
  featureFlags: RepoFeatureFlag[];
  killSwitches: RepoKillSwitch[];
  branding?: RepoBranding | null;
}
