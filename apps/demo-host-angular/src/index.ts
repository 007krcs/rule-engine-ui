import type { ApiMapping, ExecutionContext, FlowSchema, JSONValue, RuleSet, UISchema } from '@platform/schema';
import { executeStep } from '@platform/core-runtime';
import { renderAngular } from '@platform/angular-renderer';
import { createProviderFromBundles, EXAMPLE_TENANT_BUNDLES, PLATFORM_BUNDLES } from '@platform/i18n';

import exampleUi from '@platform/schema/examples/example.ui.json';
import exampleFlow from '@platform/schema/examples/example.flow.json';
import exampleRules from '@platform/schema/examples/example.rules.json';
import exampleApi from '@platform/schema/examples/example.api.json';

const baseContext: ExecutionContext = {
  tenantId: 'tenant-angular',
  userId: 'user-1',
  role: 'reviewer',
  roles: ['reviewer'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/Chicago',
  device: 'desktop',
  permissions: ['read'],
  featureFlags: { demo: true },
};

const baseData: Record<string, JSONValue> = {
  acceptedTerms: true,
  formValid: true,
  readyToSubmit: true,
  orderTotal: 1500,
  orders: [],
  revenueSeries: [10, 22, 35, 28, 42],
};

export async function runAngularDemo(target?: HTMLElement | string): Promise<string> {
  const flow = exampleFlow as unknown as FlowSchema;
  const uiSchema = exampleUi as unknown as UISchema;
  const rules = exampleRules as unknown as RuleSet;
  const apiMappingsById: Record<string, ApiMapping> = {
    submitOrder: exampleApi as unknown as ApiMapping,
  };

  const uiSchemasById: Record<string, UISchema> = {};
  for (const state of Object.values(flow.states)) {
    uiSchemasById[state.uiPageId] = uiSchema;
  }

  const result = await executeStep({
    flow,
    uiSchemasById,
    rules,
    apiMappingsById,
    stateId: flow.initialState,
    event: 'next',
    context: baseContext,
    data: baseData,
    fetchFn: async () =>
      new Response(JSON.stringify({ orderId: 'ng-1', status: 'submitted' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  });

  const i18n = createProviderFromBundles({
    locale: baseContext.locale.split('-')[0] ?? baseContext.locale,
    fallbackLocale: 'en',
    bundles: [...PLATFORM_BUNDLES, ...EXAMPLE_TENANT_BUNDLES],
    mode: 'dev',
  });

  return renderAngular({
    uiSchema: result.uiSchema,
    data: result.updatedData,
    context: result.updatedContext,
    i18n,
    target,
  });
}

if (typeof document !== 'undefined') {
  runAngularDemo('#root').catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
  });
}
