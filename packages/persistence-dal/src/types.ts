export type ConfigLifecycleStatus = 'Draft' | 'Submitted' | 'Approved' | 'Deprecated' | 'Deleted';

export interface TenantContext {
  tenantId: string;
  userId?: string;
  userName?: string;
  roles?: string[];
}

export interface DalVersionRecord {
  versionId: string;
  label: string;
  status: ConfigLifecycleStatus;
  bundle: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DalConfigRecord {
  configId: string;
  tenantId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  versions: DalVersionRecord[];
}

export interface SaveConfigInput {
  configId: string;
  name: string;
  description?: string;
  versionId?: string;
  versionLabel?: string;
  bundle: Record<string, unknown>;
}

export interface TransitionVersionInput {
  configId: string;
  versionId: string;
  toStatus: ConfigLifecycleStatus;
  notes?: string;
}

export interface PersistenceDal {
  getConfig(context: TenantContext, configId: string): Promise<DalConfigRecord | null>;
  saveConfig(context: TenantContext, input: SaveConfigInput): Promise<DalConfigRecord>;
  listConfigs(context: TenantContext): Promise<DalConfigRecord[]>;
  listVersions(context: TenantContext, configId: string): Promise<DalVersionRecord[]>;
  transitionVersion(context: TenantContext, input: TransitionVersionInput): Promise<DalVersionRecord>;
  close?(): Promise<void>;
}
