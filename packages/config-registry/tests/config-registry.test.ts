import { describe, expect, it } from 'vitest';
import type { ApiMapping, FlowSchema, RuleSet, UISchema } from '@platform/schema';
import { ConfigRegistry, createBundle } from '../src/index';

const flow: FlowSchema = {
  version: '1.0.0',
  flowId: 'demo',
  initialState: 'start',
  states: {
    start: { uiPageId: 'page-start', on: {} },
  },
};

const uiSchemasById: Record<string, UISchema> = {
  'page-start': {
    version: '1.0.0',
    pageId: 'page-start',
    layout: { id: 'root', type: 'section', componentIds: [] },
    components: [],
  },
};

const rules: RuleSet = { version: '1.0.0', rules: [] };
const apiMappingsById: Record<string, ApiMapping> = {};

describe('config-registry', () => {
  it('isolates tenants and rejects cross-tenant access', () => {
    const registry = new ConfigRegistry();
    registry.addBundle(
      createBundle({
        tenantId: 'tenant-a',
        version: '1.0.0',
        createdBy: 'rita',
        flow,
        uiSchemasById,
        rules,
        apiMappingsById,
      }),
    );
    registry.addBundle(
      createBundle({
        tenantId: 'tenant-b',
        version: '2.0.0',
        createdBy: 'yuki',
        flow,
        uiSchemasById,
        rules,
        apiMappingsById,
      }),
    );

    expect(registry.listBundles('tenant-a')).toHaveLength(1);
    expect(() => registry.activate('tenant-a', '2.0.0')).toThrow('tenant-a');
  });

  it('supports activation and rollback', () => {
    const registry = new ConfigRegistry();
    registry.addBundle(
      createBundle({
        tenantId: 'tenant-a',
        version: '1.0.0',
        createdBy: 'rita',
        flow,
        uiSchemasById,
        rules,
        apiMappingsById,
        status: 'approved',
      }),
    );
    registry.addBundle(
      createBundle({
        tenantId: 'tenant-a',
        version: '1.1.0',
        createdBy: 'rita',
        flow,
        uiSchemasById,
        rules,
        apiMappingsById,
        status: 'approved',
      }),
    );

    registry.activate('tenant-a', '1.0.0');
    registry.activate('tenant-a', '1.1.0');

    const rolledBack = registry.rollback('tenant-a', '1.0.0');
    expect(rolledBack.version).toBe('1.0.0');
    expect(registry.getActiveBundle('tenant-a')?.version).toBe('1.0.0');
  });

  it('rejects rollback to missing version', () => {
    const registry = new ConfigRegistry();
    registry.addBundle(
      createBundle({
        tenantId: 'tenant-a',
        version: '1.0.0',
        createdBy: 'rita',
        flow,
        uiSchemasById,
        rules,
        apiMappingsById,
      }),
    );

    expect(() => registry.rollback('tenant-a', '2.0.0')).toThrow('not found');
  });
});
