'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ApiMapping, ExecutionContext, FlowSchema, JSONValue, Rule, UISchema } from '@platform/schema';
import { executeStep } from '@platform/core-runtime';
import { RenderPage } from '@platform/react-renderer';
import { registerMaterialAdapters } from '@platform/react-material-adapter';
import { registerAgGridAdapter } from '@platform/react-aggrid-adapter';
import { registerHighchartsAdapter } from '@platform/react-highcharts-adapter';
import { registerD3Adapter } from '@platform/react-d3-adapter';
import { registerCompanyAdapter } from '@platform/react-company-adapter';
import { createProviderFromBundles, EXAMPLE_TENANT_BUNDLES, PLATFORM_BUNDLES } from '@platform/i18n';
import type { ConfigVersion, ConsoleSnapshot } from '@/lib/demo/types';
import { apiGet } from '@/lib/demo/api-client';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const initialContext: ExecutionContext = {
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

const initialData: Record<string, JSONValue> = {
  acceptedTerms: true,
  formValid: true,
  readyToSubmit: true,
  orderTotal: 1200,
  restricted: false,
  orders: [],
  revenueSeries: [],
  customViz: [],
};

function buildUiSchemasById(flow: FlowSchema, uiSchema: UISchema): Record<string, UISchema> {
  const map: Record<string, UISchema> = {};
  for (const state of Object.values(flow.states)) {
    map[state.uiPageId] = uiSchema;
  }
  return map;
}

async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes('api.example.com/orders')) {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const response = {
      orderId: body.orderId ?? 'demo-1',
      status: 'submitted',
      requestId: `req-${Math.random().toString(16).slice(2)}`,
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: `No local demo handler for ${url}` }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  });
}

type GetVersionResponse = { ok: true; version: ConfigVersion } | { ok: false; error: string };

type RuntimeTrace = Awaited<ReturnType<typeof executeStep>>['trace'];

export function Playground({
  initialSnapshot,
  initialVersion,
}: {
  initialSnapshot: ConsoleSnapshot;
  initialVersion: ConfigVersion | null;
}) {
  const { toast } = useToast();

  const [snapshot] = useState<ConsoleSnapshot>(initialSnapshot);
  const [selectedVersionId, setSelectedVersionId] = useState<string>(initialVersion?.id ?? '');
  const [version, setVersion] = useState<ConfigVersion | null>(initialVersion);
  const [busy, setBusy] = useState(false);

  const [stateId, setStateId] = useState<string>(() => {
    const flow = (initialVersion?.bundle.flowSchema ?? null) as unknown as FlowSchema | null;
    return flow?.initialState ?? 'start';
  });
  const [context, setContext] = useState<ExecutionContext>(initialContext);
  const [data, setData] = useState<Record<string, JSONValue>>(initialData);
  const [trace, setTrace] = useState<RuntimeTrace | null>(null);

  useEffect(() => {
    registerMaterialAdapters();
    registerAgGridAdapter();
    registerHighchartsAdapter();
    registerD3Adapter();
    registerCompanyAdapter();
  }, []);

  useEffect(() => {
    if (!selectedVersionId) return;
    if (version?.id === selectedVersionId) return;
    const loadVersion = async () => {
      setBusy(true);
      try {
        const resp = await apiGet<GetVersionResponse>(`/api/config-versions/${encodeURIComponent(selectedVersionId)}`);
        if (!resp.ok) throw new Error(resp.error);
        setVersion(resp.version);
        const flow = resp.version.bundle.flowSchema as unknown as FlowSchema;
        setStateId(flow.initialState);
        setData(initialData);
        setTrace(null);
      } catch (error) {
        toast({
          variant: 'error',
          title: 'Failed to load config version',
          description: error instanceof Error ? error.message : String(error),
        });
        setVersion(null);
      } finally {
        setBusy(false);
      }
    };
    void loadVersion();
  }, [selectedVersionId, toast, version?.id]);

  const flow = (version?.bundle.flowSchema ?? null) as unknown as FlowSchema | null;
  const uiSchema = (version?.bundle.uiSchema ?? null) as unknown as UISchema | null;
  const rules: Rule[] = (((version?.bundle.rules as any)?.rules ?? []) as Rule[]) ?? [];
  const apiMappingsById: Record<string, ApiMapping> = version?.bundle.apiMappingsById ?? {};

  const uiSchemasById = useMemo(() => {
    if (!flow || !uiSchema) return {};
    return buildUiSchemasById(flow, uiSchema);
  }, [flow, uiSchema]);

  const baseLocale = context.locale.split('-')[0] ?? context.locale;
  const i18n = useMemo(
    () =>
      createProviderFromBundles({
        locale: baseLocale,
        fallbackLocale: 'en',
        bundles: [...PLATFORM_BUNDLES, ...EXAMPLE_TENANT_BUNDLES],
        mode: 'dev',
      }),
    [baseLocale],
  );

  const currentState = flow ? flow.states[stateId] : null;
  const currentUiSchema = currentState && uiSchema ? uiSchemasById[currentState.uiPageId] ?? uiSchema : uiSchema;

  const runEvent = async (event: string) => {
    if (!flow || !currentUiSchema) return;
    setBusy(true);
    try {
      const result = await executeStep({
        flow,
        uiSchemasById,
        rules,
        apiMappingsById,
        stateId,
        event,
        context,
        data,
        fetchFn: demoFetch as any,
      });
      setStateId(result.nextStateId);
      setContext(result.updatedContext);
      setData(result.updatedData as Record<string, JSONValue>);
      setTrace(result.trace);
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Runtime error',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (!flow) return;
    setStateId(flow.initialState);
    setContext(initialContext);
    setData(initialData);
    setTrace(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr_420px]">
      <Card>
        <CardHeader>
          <CardTitle>Context Simulator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Config Version</label>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              value={selectedVersionId}
              onChange={(event) => setSelectedVersionId(event.target.value)}
              disabled={(snapshot?.versions.length ?? 0) === 0}
            >
              {(snapshot?.versions ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version} ({v.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Role</label>
              <Input value={context.role} onChange={(event) => setContext({ ...context, role: event.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Country</label>
              <Input
                value={context.country}
                onChange={(event) => setContext({ ...context, country: event.target.value as ExecutionContext['country'] })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Device</label>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={context.device}
                onChange={(event) => setContext({ ...context, device: event.target.value as ExecutionContext['device'] })}
              >
                <option value="desktop">Desktop</option>
                <option value="tablet">Tablet</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Locale</label>
              <Input value={context.locale} onChange={(event) => setContext({ ...context, locale: event.target.value })} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={reset} disabled={busy}>
              Reset
            </Button>
            <Button size="sm" onClick={() => runEvent('back')} disabled={busy || !flow}>
              Back
            </Button>
            <Button size="sm" onClick={() => runEvent('next')} disabled={busy || !flow}>
              Next
            </Button>
            <Button size="sm" onClick={() => runEvent('submit')} disabled={busy || !flow}>
              Submit
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">State:</span> {stateId}
            </p>
            <p>
              <span className="font-semibold text-foreground">Event:</span> {trace?.flow.event ?? '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rendered UI</CardTitle>
        </CardHeader>
        <CardContent>
          {!currentUiSchema ? (
            <p className="text-sm text-muted-foreground">Select a config version to render.</p>
          ) : (
            <RenderPage uiSchema={currentUiSchema} data={data} context={context} i18n={i18n} />
          )}
        </CardContent>
      </Card>

      <TracePanel trace={trace} apiMappingsById={apiMappingsById} />
    </div>
  );
}

function TracePanel({
  trace,
  apiMappingsById,
}: {
  trace: RuntimeTrace | null;
  apiMappingsById: Record<string, ApiMapping>;
}) {
  if (!trace) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-sm text-muted-foreground">Run Back/Next/Submit to generate a trace.</p>
        </CardContent>
      </Card>
    );
  }

  const flow = trace.flow;
  const rules = trace.rules;
  const api = trace.api;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trace</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Flow</p>
          <p className="mt-1">
            <span className="font-semibold">{flow.event}</span> - {flow.fromStateId} -&gt; {flow.toStateId} -{' '}
            <span className={flow.reason === 'ok' ? 'text-emerald-400' : 'text-amber-500'}>{flow.reason}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            uiPageId: <span className="font-mono text-foreground">{flow.uiPageId}</span> - actions:{' '}
            {flow.actionsToRun.length ? flow.actionsToRun.join(', ') : 'none'}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Rules</p>
          {!rules ? (
            <p className="mt-1 text-xs text-muted-foreground">Skipped</p>
          ) : (
            <>
              <p className="mt-1">
                Matched {rules.rulesMatched.length}/{rules.rulesConsidered.length} rules in {rules.durationMs}ms
              </p>
              {rules.rulesMatched.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">Hits: {rules.rulesMatched.join(', ')}</p>
              ) : null}
              {rules.actionsApplied.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Actions: {rules.actionsApplied.map((applied) => `${applied.ruleId}:${applied.action.type}`).join(', ')}
                </p>
              ) : null}
              {rules.errors.length > 0 ? (
                <p className="mt-1 text-xs text-rose-400">Errors: {rules.errors.map((err) => err.message).join(' - ')}</p>
              ) : null}
            </>
          )}
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">API</p>
          {!api ? (
            <p className="mt-1 text-xs text-muted-foreground">Skipped</p>
          ) : (
            <>
              <p className="mt-1">
                {api.method} {api.endpoint}{' '}
                <span className={api.response?.status && api.response.status < 400 ? 'text-emerald-400' : 'text-amber-500'}>
                  {api.response?.status ?? 'error'}
                </span>{' '}
                - {api.durationMs}ms
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                mapping: <span className="font-mono text-foreground">{apiMappingsById[api.apiId]?.apiId ?? api.apiId}</span>
              </p>
              {api.error ? <p className="mt-1 text-xs text-rose-400">{api.error}</p> : null}
            </>
          )}
        </div>

        <details className="rounded-lg border border-border bg-muted/20 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">Raw JSON</summary>
          <pre className="mt-3 max-h-[320px] overflow-auto rounded-lg bg-muted/40 p-3 text-xs text-foreground">
            {JSON.stringify(trace, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}
