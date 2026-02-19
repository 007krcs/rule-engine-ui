import { describe, expect, it } from 'vitest';
import { assembleBundle } from '../src/lib/application-bundle';
import { createInitialBuilderFlowState } from '../src/lib/flow-engine';

describe('assembleBundle', () => {
  it('builds a unified application bundle from builder state', () => {
    const flowState = createInitialBuilderFlowState();
    const bundle = assembleBundle({
      flowGraph: flowState.flow,
      uiSchemasByScreenId: flowState.schemasByScreenId,
      configId: 'cfg-builder-test',
      tenantId: 'tenant-builder',
      version: 3,
      status: 'DRAFT',
      createdAt: '2026-02-19T00:00:00.000Z',
      updatedAt: '2026-02-19T00:00:00.000Z',
    });

    expect(bundle.metadata.configId).toBe('cfg-builder-test');
    expect(bundle.metadata.tenantId).toBe('tenant-builder');
    expect(bundle.metadata.version).toBe(3);
    expect(bundle.metadata.status).toBe('DRAFT');
    expect(Object.keys(bundle.uiSchemas)).toHaveLength(1);
    expect(bundle.flowSchema.initialState).toBe(flowState.activeScreenId);
    expect(bundle.rules.rules).toHaveLength(0);
    expect(bundle.apiMappings).toHaveLength(0);
  });
});
