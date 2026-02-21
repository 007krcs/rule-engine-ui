import type { ApiMapping, FlowSchema, RuleSet, UISchema } from '@platform/schema';
import type { ComponentDefinition } from '@platform/component-registry';
import type { TranslationBundle } from '@platform/i18n';

export type ConfigStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'DEPRECATED'
  | 'RETIRED';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';

export type AuditSeverity = 'info' | 'warning' | 'error';

export type ConfigBundle = {
  uiSchema?: UISchema;
  uiSchemasById?: Record<string, UISchema>;
  activeUiPageId?: string;
  flowSchema: FlowSchema;
  rules: RuleSet;
  apiMappingsById: Record<string, ApiMapping>;
};

export type ConfigPackage = {
  id: string;
  tenantId: string;
  configId: string;
  name: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  versions: ConfigVersion[];
};

export type ConfigVersion = {
  id: string;
  packageId: string;
  version: string;
  status: ConfigStatus;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  bundle: ConfigBundle;
  isKilled?: boolean;
  killReason?: string;
};

export type ApprovalRequest = {
  id: string;
  versionId: string;
  packageId: string;
  requestedBy: string;
  requestedAt: string;
  scope: string;
  risk: RiskLevel;
  status: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  notes?: string;
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  severity: AuditSeverity;
  metadata?: Record<string, unknown>;
};

export type FeatureFlag = {
  id: string;
  tenantId: string;
  env: string;
  key: string;
  enabled: boolean;
  value: Record<string, unknown>;
  updatedBy?: string;
  updatedAt: string;
};

export type KillSwitch = {
  id: string;
  tenantId: string;
  scope: 'TENANT' | 'RULESET' | 'VERSION' | 'COMPONENT';
  packageId?: string;
  versionId?: string;
  componentId?: string;
  rulesetKey?: string;
  active: boolean;
  reason?: string;
  updatedBy?: string;
  updatedAt: string;
};

export type BrandingConfig = {
  tenantId: string;
  logoUrl?: string;
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  secondaryColor: string;
  typographyScale: number;
  radius: number;
  spacing: number;
  cssVariables: Record<string, unknown>;
  updatedBy?: string;
  updatedAt: string;
};

export type GitOpsBundle = {
  schemaVersion: 1;
  exportedAt: string;
  tenantId: string;
  payload: {
    packages: ConfigPackage[];
    versions?: ConfigVersion[];
    approvals: ApprovalRequest[];
    audit: AuditEvent[];
    featureFlags?: FeatureFlag[];
    killSwitches?: KillSwitch[];
    branding?: BrandingConfig;
    componentRegistry?: {
      global: ComponentDefinition[];
      tenants: Record<string, ComponentDefinition[]>;
    };
    translations?: {
      fallbackLocale: string;
      tenantLocale?: string;
      userLocale?: string;
      bundles: TranslationBundle[];
    };
  };
  signature: {
    alg: 'HMAC-SHA256';
    keyId: string;
    value: string;
  };
};

export type ConsoleSnapshot = {
  tenantId: string;
  packages: ConfigPackage[];
  versions: ConfigVersion[];
  approvals: ApprovalRequest[];
  audit: AuditEvent[];
};

export type JsonDiffItem = {
  path: string;
  before: unknown;
  after: unknown;
};
