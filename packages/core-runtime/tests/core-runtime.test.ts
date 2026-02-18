import { describe, expect, it } from 'vitest';
import type { ApiMapping, ExecutionContext, FlowSchema, Rule, UISchema } from '@platform/schema';
import { executeStep } from '../src/index';

const context: ExecutionContext = {
  tenantId: 't1',
  userId: 'u1',
  role: 'user',
  roles: ['user'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
  device: 'desktop',
  permissions: [],
  featureFlags: {},
};

const flow: FlowSchema = {
  version: '1.0.0',
  flowId: 'demo',
  initialState: 'start',
  states: {
    start: {
      uiPageId: 'page-start',
      on: {
        submit: {
          target: 'done',
          actions: ['evaluateRules', 'callApi'],
          apiId: 'submitOrder',
        },
      },
    },
    done: {
      uiPageId: 'page-done',
      on: {},
    },
  },
};

const rules: Rule[] = [
  {
    ruleId: 'SET_READY',
    priority: 1,
    when: { op: 'eq', left: { value: true }, right: { value: true } },
    actions: [{ type: 'setField', path: 'data.status', value: 'ready' }],
  },
];

const apiMapping: ApiMapping = {
  version: '1.0.0',
  apiId: 'submitOrder',
  type: 'rest',
  method: 'POST',
  endpoint: 'https://api.example.com/orders',
  requestMap: {
    body: {
      status: { from: 'data.status' },
    },
  },
  responseMap: {
    data: {
      orderId: 'response.orderId',
      status: 'response.status',
    },
  },
};

const uiSchemasById: Record<string, UISchema> = {
  'page-start': {
    version: '1.0.0',
    pageId: 'page-start',
    layout: { id: 'root', type: 'section', componentIds: [], title: 'Start' },
    components: [],
  },
  'page-done': {
    version: '1.0.0',
    pageId: 'page-done',
    layout: { id: 'root', type: 'section', componentIds: [], title: 'Done' },
    components: [],
  },
};

describe('core-runtime', () => {
  it('executes flow, rules, and api in order', async () => {
    const fetchFn = async () =>
      new Response(JSON.stringify({ orderId: 'o-1', status: 'submitted' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    const result = await executeStep({
      flow,
      uiSchemasById,
      rules,
      apiMappingsById: { submitOrder: apiMapping },
      stateId: 'start',
      event: 'submit',
      context,
      data: {},
      fetchFn,
    });

    expect(result.nextStateId).toBe('done');
    expect(result.updatedData.status).toBe('submitted');
    expect(result.updatedData.orderId).toBe('o-1');
    expect(result.uiSchema.pageId).toBe('page-done');
  });

  it('fails fast when validation fails', async () => {
    const invalidSchemas: Record<string, UISchema> = {
      'page-start': {
        version: '1.0.0',
        pageId: 'page-start',
        layout: { id: 'root', type: 'section', componentIds: ['field'] },
        components: [
          {
            id: 'field',
            type: 'input',
            adapterHint: 'material.input',
            accessibility: {
              ariaLabelKey: '',
              keyboardNav: false,
              focusOrder: 0,
            },
          },
        ],
      },
      'page-done': {
        version: '1.0.0',
        pageId: 'page-done',
        layout: { id: 'root', type: 'section', componentIds: [] },
        components: [],
      },
    };

    await expect(
      executeStep({
        flow,
        uiSchemasById: invalidSchemas,
        rules,
        apiMappingsById: { submitOrder: apiMapping },
        stateId: 'start',
        event: 'submit',
        context,
        data: {},
        validate: true,
        fetchFn: async () =>
          new Response(JSON.stringify({ orderId: 'o-2', status: 'submitted' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      }),
    ).rejects.toThrow('UISchema validation failed');
  });

  it('emits trace logs through callback', async () => {
    let traceSeen = false;
    const result = await executeStep({
      flow,
      uiSchemasById,
      rules,
      apiMappingsById: { submitOrder: apiMapping },
      stateId: 'start',
      event: 'submit',
      context,
      data: {},
      traceLogger: (trace) => {
        traceSeen = !!trace.startedAt;
      },
      fetchFn: async () =>
        new Response(JSON.stringify({ orderId: 'o-3', status: 'submitted' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    expect(traceSeen).toBe(true);
    expect(result.trace.flow.reason).toBe('ok');
  });

  it('blocks execution when kill switch is active', async () => {
    await expect(
      executeStep({
        flow,
        uiSchemasById,
        rules,
        apiMappingsById: { submitOrder: apiMapping },
        stateId: 'start',
        event: 'submit',
        context,
        data: {},
        killSwitch: {
          active: true,
          reason: 'Emergency stop',
        },
      }),
    ).rejects.toThrow('Execution blocked by kill switch: Emergency stop');
  });
});
