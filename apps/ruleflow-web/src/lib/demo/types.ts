import type { ApiMapping, FlowSchema, RuleSet, UISchema } from '@platform/schema';
import type { ComponentDefinition } from '@platform/component-registry';

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
  uiSchema: UISchema;
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

export type GitOpsBundle = {
  schemaVersion: 1;
  exportedAt: string;
  tenantId: string;
  payload: {
    packages: ConfigPackage[];
    approvals: ApprovalRequest[];
    audit: AuditEvent[];
    componentRegistry?: {
      global: ComponentDefinition[];
      tenants: Record<string, ComponentDefinition[]>;
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
