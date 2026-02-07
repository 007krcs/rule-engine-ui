import type {
  ApiMapping,
  ExecutionContext,
  FlowSchema,
  JSONValue,
  Rule,
  UISchema,
} from '@platform/schema';
import { executeStep } from '@platform/core-runtime';
import exampleUi from '@platform/schema/examples/example.ui.json';
import exampleFlow from '@platform/schema/examples/example.flow.json';
import exampleRules from '@platform/schema/examples/example.rules.json';
import exampleApi from '@platform/schema/examples/example.api.json';

const context: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'admin',
  roles: ['admin'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
  device: 'desktop',
  permissions: ['read'],
  featureFlags: { demo: true },
};

const data: Record<string, JSONValue> = {
  acceptedTerms: true,
  formValid: true,
  readyToSubmit: true,
  orderTotal: 1200,
};

const flow = exampleFlow as unknown as FlowSchema;
const uiSchema = exampleUi as unknown as UISchema;
const uiSchemasById: Record<string, UISchema> = {};
for (const state of Object.values(flow.states)) {
  uiSchemasById[state.uiPageId] = uiSchema;
}

async function run(): Promise<void> {
  console.log('Starting demo flow...');

  const rules = (exampleRules as unknown as { rules: Rule[] }).rules;
  const apiMappingsById: Record<string, ApiMapping> = {
    submitOrder: exampleApi as unknown as ApiMapping,
  };

  let stateId = flow.initialState;
  let currentContext = context;
  let currentData: Record<string, JSONValue> = data;

  const nextResult = await executeStep({
    flow,
    uiSchemasById,
    rules,
    apiMappingsById,
    stateId,
    event: 'next',
    context: currentContext,
    data: currentData,
    fetchFn: async () =>
      new Response(JSON.stringify({ orderId: 'demo-1', status: 'submitted', requestId: 'req-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  });

  stateId = nextResult.nextStateId;
  currentContext = nextResult.updatedContext;
  currentData = nextResult.updatedData as Record<string, JSONValue>;
  console.log('After next:', nextResult.trace.flow.reason);

  const submitResult = await executeStep({
    flow,
    uiSchemasById,
    rules,
    apiMappingsById,
    stateId,
    event: 'submit',
    context: currentContext,
    data: currentData,
    fetchFn: async () =>
      new Response(JSON.stringify({ orderId: 'demo-1', status: 'submitted', requestId: 'req-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  });

  console.log('After submit:', submitResult.trace.flow.reason);
  console.log('Trace:', JSON.stringify(submitResult.trace, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
