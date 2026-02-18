import { describe, expect, it } from 'vitest';
import type { FlowSchema, UISchema } from '@platform/schema';
import {
  applyUiPageUpdateToBundle,
  normalizeUiPages,
  rebindFlowSchemaToAvailablePages,
} from '../src/lib/demo/ui-pages';

function makeSchema(pageId: string): UISchema {
  return {
    version: '1.0.0',
    pageId,
    layout: { id: 'root', type: 'grid', componentIds: [] },
    components: [],
    layoutType: 'grid',
  };
}

function makeFlow(pageId: string): FlowSchema {
  return {
    version: '1.0.0',
    flowId: 'flow',
    initialState: 'start',
    states: {
      start: { uiPageId: pageId, on: {} },
    },
  };
}

describe('ui-pages normalization', () => {
  it('normalizes legacy single-page bundle shape', () => {
    const legacyUi = makeSchema('orders');
    const normalized = normalizeUiPages({
      uiSchema: legacyUi,
      flowSchema: makeFlow('orders'),
    });

    expect(normalized.activeUiPageId).toBe('orders');
    expect(Object.keys(normalized.uiSchemasById)).toEqual(['orders']);
    expect(normalized.uiSchemasById.orders?.pageId).toBe('orders');
  });

  it('rebounds flow state page ids to available pages', () => {
    const flow: FlowSchema = {
      version: '1.0.0',
      flowId: 'flow',
      initialState: 'start',
      states: {
        start: { uiPageId: 'missing', on: {} },
        review: { uiPageId: 'also-missing', on: {} },
      },
    };

    const rebound = rebindFlowSchemaToAvailablePages(flow, { orders: makeSchema('orders') }, 'orders');
    expect(rebound?.states.start.uiPageId).toBe('orders');
    expect(rebound?.states.review.uiPageId).toBe('orders');
  });

  it('applies multi-page updates while keeping backward uiSchema convenience', () => {
    const bundle = {
      uiSchema: makeSchema('orders'),
      flowSchema: makeFlow('orders'),
      rules: { version: '1.0.0', rules: [] },
      apiMappingsById: {},
    };
    const details = makeSchema('details');

    const updated = applyUiPageUpdateToBundle(bundle, {
      uiSchemasById: {
        orders: makeSchema('orders'),
        details,
      },
      activeUiPageId: 'details',
      flowSchema: {
        version: '1.0.0',
        flowId: 'flow',
        initialState: 'start',
        states: {
          start: { uiPageId: 'details', on: {} },
        },
      },
    });

    expect(updated.activeUiPageId).toBe('details');
    expect(Object.keys(updated.uiSchemasById ?? {})).toEqual(['orders', 'details']);
    expect(updated.uiSchema?.pageId).toBe('details');
    expect(updated.flowSchema.states.start.uiPageId).toBe('details');
  });
});
