import { describe, expect, it } from 'vitest';
import {
  assembleChunkedApplicationBundle,
  assembleApplicationBundle,
  chunkApplicationBundle,
  createChunkLoader,
  createEmptyRuleset,
  createFlowGraph,
  createFlowScreen,
  createFlowTransition,
  flowGraphToStateMachine,
  serializeApplicationBundle,
  type ApplicationBundle,
} from '../src';

describe('application bundle helpers', () => {
  it('assembles a unified bundle with defaults', () => {
    const flowGraph = createFlowGraph({
      flowId: 'bundle-flow',
      screens: [
        createFlowScreen({ id: 'screen-a', title: 'Screen A', uiPageId: 'screen-a-page' }),
        createFlowScreen({ id: 'screen-b', title: 'Screen B', uiPageId: 'screen-b-page' }),
      ],
      initialScreenId: 'screen-a',
      transitions: [
        createFlowTransition({
          id: 'transition-a',
          from: 'screen-a',
          to: 'screen-b',
          onEvent: 'next',
          condition: 'rule:EligibilityPassed',
        }),
      ],
    });

    const flowSchema = flowGraphToStateMachine(flowGraph);
    const bundle = assembleApplicationBundle({
      metadata: {
        configId: 'cfg-001',
        version: 1,
        status: 'DRAFT',
        tenantId: 'tenant-1',
        createdAt: '2026-02-19T00:00:00.000Z',
        updatedAt: '2026-02-19T00:00:00.000Z',
      },
      uiSchemas: {
        'screen-a': {
          version: '1.0.0',
          pageId: 'screen-a-page',
          layout: {
            id: 'root',
            type: 'stack',
            direction: 'vertical',
          },
          components: [],
        },
      },
      flowSchema,
      flowGraph,
    });

    expect(bundle.metadata.configId).toBe('cfg-001');
    expect(bundle.rules).toEqual(createEmptyRuleset());
    expect(bundle.apiMappings).toEqual([]);
    expect(bundle.flowSchema.initialState).toBe('screen-a');
  });

  it('serializes bundle into JSON string', () => {
    const bundle: ApplicationBundle = {
      metadata: {
        configId: 'cfg-002',
        version: 2,
        status: 'PUBLISHED',
        tenantId: 'tenant-2',
        createdAt: '2026-02-19T00:00:00.000Z',
        updatedAt: '2026-02-19T01:00:00.000Z',
      },
      uiSchemas: {},
      flowSchema: {
        version: '1.0.0',
        flowId: 'demo',
        initialState: 'start',
        states: {
          start: {
            uiPageId: 'start-page',
            on: {},
          },
        },
      },
      rules: {
        version: '1.0.0',
        rules: [],
      },
      apiMappings: [],
    };

    const json = serializeApplicationBundle(bundle);
    expect(typeof json).toBe('string');
    expect(json).toContain('"configId": "cfg-002"');
    expect(json).toContain('"status": "PUBLISHED"');
  });

  it('chunks and lazy-loads bundle segments', async () => {
    const bundle: ApplicationBundle = {
      metadata: {
        configId: 'cfg-003',
        version: 3,
        status: 'DRAFT',
        tenantId: 'tenant-3',
        createdAt: '2026-02-20T00:00:00.000Z',
        updatedAt: '2026-02-20T00:00:00.000Z',
      },
      uiSchemas: {
        screen: {
          version: '1.0.0',
          pageId: 'screen',
          layout: { id: 'root', type: 'stack' },
          components: [],
        },
      },
      flowSchema: {
        version: '1.0.0',
        flowId: 'flow',
        initialState: 'screen',
        states: { screen: { uiPageId: 'screen', on: {} } },
      },
      rules: { version: '1.0.0', rules: [] },
      apiMappings: [],
    };

    const { manifest, chunks } = chunkApplicationBundle(bundle, {
      minBytes: 1,
      keys: ['uiSchemas', 'flowSchema', 'rules'],
      chunkIdPrefix: 'chunk-test',
    });

    expect(manifest.chunks.uiSchemas).toBe('chunk-test:uiSchemas');
    const rebuilt = await assembleChunkedApplicationBundle({
      manifest,
      loadChunk: async (chunkId) => createChunkLoader(chunks)(chunkId),
    });
    expect(rebuilt.metadata.configId).toBe(bundle.metadata.configId);
    expect(rebuilt.flowSchema.initialState).toBe('screen');
    expect(Object.keys(rebuilt.uiSchemas)).toContain('screen');
  });
});
