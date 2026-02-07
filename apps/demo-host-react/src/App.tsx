import React, { useMemo, useState } from 'react';
import type { ApiMapping, ExecutionContext, FlowSchema, JSONValue, Rule, UISchema } from '@platform/schema';
import { RenderPage } from '@platform/react-renderer';
import { executeStep } from '@platform/core-runtime';

import exampleUi from '@platform/schema/examples/example.ui.json';
import exampleFlow from '@platform/schema/examples/example.flow.json';
import exampleRules from '@platform/schema/examples/example.rules.json';
import exampleApi from '@platform/schema/examples/example.api.json';

const initialContext: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'admin',
  roles: ['admin'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
  device: 'desktop',
  permissions: ['read', 'write'],
  featureFlags: { demo: true },
};

const initialData = {
  acceptedTerms: true,
  formValid: true,
  readyToSubmit: true,
  orderTotal: 1200,
  restricted: false,
  orders: [],
  revenueSeries: [],
  customViz: [],
};

export default function App(): React.ReactElement {
  const flow = exampleFlow as unknown as FlowSchema;
  const uiSchema = exampleUi as unknown as UISchema;
  const rules = (exampleRules as unknown as { rules: Rule[] }).rules;
  const apiMappingsById: Record<string, ApiMapping> = {
    submitOrder: exampleApi as unknown as ApiMapping,
  };

  const [stateId, setStateId] = useState<string>(flow.initialState);
  const [context, setContext] = useState<ExecutionContext>(initialContext);
  const [data, setData] = useState<Record<string, JSONValue>>(initialData);
  const [trace, setTrace] = useState<unknown>(null);

  const uiSchemasById = useMemo<Record<string, UISchema>>(() => {
    const map: Record<string, UISchema> = {};
    for (const state of Object.values(flow.states)) {
      map[state.uiPageId] = uiSchema;
    }
    return map;
  }, [flow, uiSchema]);

  const currentState = flow.states[stateId];
  const currentUiSchema = currentState ? uiSchemasById[currentState.uiPageId] ?? uiSchema : uiSchema;

  const runEvent = async (event: string) => {
    const fetchFn = async () =>
      new Response(JSON.stringify({ orderId: 'demo-1', status: 'submitted', requestId: 'req-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    const result = await executeStep({
      flow,
      uiSchemasById,
      rules,
      apiMappingsById,
      stateId,
      event,
      context,
      data,
      fetchFn,
    });

    setStateId(result.nextStateId);
    setContext(result.updatedContext);
    setData(result.updatedData as Record<string, JSONValue>);
    setTrace(result.trace);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, padding: 24 }}>
      <div>
        <h1>Demo Host (React)</h1>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => runEvent('back')}>Back</button>
          <button onClick={() => runEvent('next')}>Next</button>
          <button onClick={() => runEvent('submit')}>Submit</button>
        </div>
        <RenderPage uiSchema={currentUiSchema} data={data} context={context} />
      </div>
      <aside>
        <h2>Trace</h2>
        <pre style={{ fontSize: 12, background: '#f3f3f3', padding: 12 }}>
          {JSON.stringify(trace, null, 2)}
        </pre>
      </aside>
    </div>
  );
}
