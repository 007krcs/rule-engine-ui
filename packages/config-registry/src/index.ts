import type { ApiMapping, FlowSchema, RuleSet, UISchema } from '@platform/schema';

export type ConfigStatus = 'draft' | 'review' | 'approved' | 'active' | 'deprecated' | 'retired';

export interface ConfigBundle {
  id: string;
  tenantId: string;
  version: string;
  createdAt: string;
  createdBy: string;
  status: ConfigStatus;
  description?: string;
  flow: FlowSchema;
  uiSchemasById: Record<string, UISchema>;
  rules: RuleSet;
  apiMappingsById: Record<string, ApiMapping>;
}

export type RegistryEventType = 'created' | 'promoted' | 'activated' | 'deprecated' | 'rollback';

export interface RegistryEvent {
  id: string;
  tenantId: string;
  version: string;
  type: RegistryEventType;
  at: string;
  actor?: string;
  fromVersion?: string;
  toVersion?: string;
  note?: string;
}

export interface RegistryOptions {
  now?: () => Date;
  eventIdFactory?: () => string;
}

export class ConfigRegistry {
  private store = new Map<string, ConfigBundle[]>();
  private events: RegistryEvent[] = [];
  private now: () => Date;
  private eventIdFactory: () => string;

  constructor(options?: RegistryOptions) {
    this.now = options?.now ?? (() => new Date());
    this.eventIdFactory = options?.eventIdFactory ?? (() => `evt-${Math.random().toString(36).slice(2, 10)}`);
  }

  addBundle(bundle: ConfigBundle): void {
    const tenantId = bundle.tenantId;
    const list = this.store.get(tenantId) ?? [];
    if (list.some((item) => item.version === bundle.version)) {
      throw new Error(`Version already exists for tenant ${tenantId}: ${bundle.version}`);
    }
    list.push(clone(bundle));
    this.store.set(tenantId, list);
    this.recordEvent({
      tenantId,
      version: bundle.version,
      type: 'created',
      actor: bundle.createdBy,
      note: bundle.description,
    });
  }

  listBundles(tenantId: string): ConfigBundle[] {
    const list = this.store.get(tenantId) ?? [];
    return list.map(clone);
  }

  getBundle(tenantId: string, version: string): ConfigBundle | undefined {
    return this.findBundle(tenantId, version)?.clone;
  }

  getActiveBundle(tenantId: string): ConfigBundle | undefined {
    const list = this.store.get(tenantId) ?? [];
    const active = list.find((bundle) => bundle.status === 'active');
    return active ? clone(active) : undefined;
  }

  promote(
    tenantId: string,
    version: string,
    status: Exclude<ConfigStatus, 'active'>,
    actor?: string,
  ): ConfigBundle {
    const target = this.assertBundle(tenantId, version);
    if (target.status === 'retired') {
      throw new Error(`Cannot promote retired config ${version} for tenant ${tenantId}`);
    }
    target.status = status;
    this.recordEvent({ tenantId, version, type: 'promoted', actor, note: `status:${status}` });
    return clone(target);
  }

  activate(tenantId: string, version: string, actor?: string): ConfigBundle {
    const list = this.store.get(tenantId) ?? [];
    const target = this.assertBundle(tenantId, version);
    if (target.status === 'retired') {
      throw new Error(`Cannot activate retired config ${version} for tenant ${tenantId}`);
    }
    const current = list.find((bundle) => bundle.status === 'active');
    if (current && current.version !== version) {
      current.status = 'deprecated';
      this.recordEvent({
        tenantId,
        version: current.version,
        type: 'deprecated',
        actor,
        fromVersion: current.version,
        toVersion: version,
      });
    }
    target.status = 'active';
    this.recordEvent({ tenantId, version, type: 'activated', actor });
    return clone(target);
  }

  rollback(tenantId: string, targetVersion: string, actor?: string): ConfigBundle {
    const list = this.store.get(tenantId) ?? [];
    if (list.length === 0) {
      throw new Error(`No configs found for tenant ${tenantId}`);
    }
    const currentActive = list.find((bundle) => bundle.status === 'active');
    const target = this.assertBundle(tenantId, targetVersion);
    if (target.status === 'retired') {
      throw new Error(`Cannot rollback to retired config ${targetVersion} for tenant ${tenantId}`);
    }
    const activated = this.activate(tenantId, targetVersion, actor);
    this.recordEvent({
      tenantId,
      version: targetVersion,
      type: 'rollback',
      actor,
      fromVersion: currentActive?.version,
      toVersion: targetVersion,
    });
    return activated;
  }

  getEvents(tenantId: string): RegistryEvent[] {
    return this.events.filter((event) => event.tenantId === tenantId).map(clone);
  }

  private assertBundle(tenantId: string, version: string): ConfigBundle {
    const bundle = this.store.get(tenantId)?.find((item) => item.version === version);
    if (!bundle) {
      throw new Error(`Config version ${version} not found for tenant ${tenantId}`);
    }
    return bundle;
  }

  private findBundle(
    tenantId: string,
    version: string,
  ): { original: ConfigBundle; clone: ConfigBundle } | undefined {
    const bundle = this.store.get(tenantId)?.find((item) => item.version === version);
    if (!bundle) return undefined;
    return { original: bundle, clone: clone(bundle) };
  }

  private recordEvent(event: Omit<RegistryEvent, 'id' | 'at'>): void {
    this.events.push({
      id: this.eventIdFactory(),
      at: this.now().toISOString(),
      ...event,
    });
  }
}

export function createBundle(params: {
  tenantId: string;
  version: string;
  createdBy: string;
  flow: FlowSchema;
  uiSchemasById: Record<string, UISchema>;
  rules: RuleSet;
  apiMappingsById: Record<string, ApiMapping>;
  description?: string;
  status?: ConfigStatus;
  id?: string;
  createdAt?: string;
}): ConfigBundle {
  return {
    id: params.id ?? `cfg-${params.tenantId}-${params.version}`,
    tenantId: params.tenantId,
    version: params.version,
    createdAt: params.createdAt ?? new Date().toISOString(),
    createdBy: params.createdBy,
    status: params.status ?? 'draft',
    description: params.description,
    flow: params.flow,
    uiSchemasById: params.uiSchemasById,
    rules: params.rules,
    apiMappingsById: params.apiMappingsById,
  };
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
