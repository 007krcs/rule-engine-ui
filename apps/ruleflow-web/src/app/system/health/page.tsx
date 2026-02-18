'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiMapping, ExecutionContext, FlowSchema, JSONValue, Rule, UISchema } from '@platform/schema';
import { executeStep } from '@platform/core-runtime';
import { RenderPage } from '@platform/react-renderer';
import { createProviderFromBundles, EXAMPLE_TENANT_BUNDLES, PLATFORM_BUNDLES } from '@platform/i18n';
import type { ConfigVersion, ConsoleSnapshot } from '@/lib/demo/types';
import { apiGet, apiPost } from '@/lib/demo/api-client';
import { normalizeUiPages, rebindFlowSchemaToAvailablePages } from '@/lib/demo/ui-pages';
import { useRuntimeAdapters } from '@/lib/use-runtime-adapters';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import styles from './health.module.css';

type CheckStatus = 'pending' | 'pass' | 'fail';

type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
};

type GetVersionResponse = { ok: true; version: ConfigVersion } | { ok: false; error: string };
type SystemHealthResponse = {
  ok: true;
  checkedAt: string;
  canWriteToStore: boolean;
  store: {
    provider: string;
    baseDir: string | null;
    canWriteToStore: boolean;
    warning?: string;
  };
};

const initialContext: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'health',
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

async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes('api.example.com/orders')) {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const response = {
      orderId: body.orderId ?? 'demo-1',
      status: 'submitted',
      requestId: 'req-health',
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

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'GET', signal: controller.signal, headers: { 'cache-control': 'no-store' } });
  } finally {
    window.clearTimeout(timer);
  }
}

class ErrorBoundary extends React.Component<
  { onError: (error: Error) => void; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function HealthPage() {
  const { toast } = useToast();
  const runtimeAdapters = useRuntimeAdapters({ env: 'prod' });
  const [checks, setChecks] = useState<Check[]>([
    { id: 'routes', label: 'Routes respond (200)', status: 'pending' },
    { id: 'api', label: 'Console API returns snapshot', status: 'pending' },
    { id: 'store', label: 'Store persistence is writable', status: 'pending' },
    { id: 'adapters', label: 'Adapters registered (renderer has no missing adapters)', status: 'pending' },
    { id: 'flow', label: 'Sample flow executes through submit (rules + api)', status: 'pending' },
  ]);

  const [routeDetails, setRouteDetails] = useState<Array<{ path: string; status: number | null }>>([]);
  const [storeHealth, setStoreHealth] = useState<SystemHealthResponse | null>(null);
  const [adapterError, setAdapterError] = useState<string | null>(null);
  const [adapterMissingCount, setAdapterMissingCount] = useState<number | null>(null);

  const adapterTestRef = useRef<HTMLDivElement | null>(null);

  const routesToCheck = useMemo(
    () => [
      '/',
      '/console',
      '/console?tab=governance',
      '/builder',
      '/playground',
      '/docs',
      '/docs/quickstart',
      '/integrations',
      '/system/health',
      '/system/roadmap',
    ],
    [],
  );

  const adapterTestSchema = useMemo(() => {
    const components: UISchema['components'] = [
      {
        id: 'materialInput',
        type: 'input',
        adapterHint: 'material.input',
        props: {},
        i18n: { labelKey: 'runtime.filters.customerName.label' },
        accessibility: { ariaLabelKey: 'runtime.filters.customerName.aria', keyboardNav: true, focusOrder: 1 },
      },
      {
        id: 'ordersTable',
        type: 'table',
        adapterHint: 'aggrid.table',
        props: { columns: [{ field: 'orderId', headerKey: 'runtime.orders.table.columns.orderId' }], rows: [] },
        i18n: { labelKey: 'runtime.orders.table.label' },
        accessibility: { ariaLabelKey: 'runtime.orders.table.aria', keyboardNav: true, focusOrder: 2 },
      },
      {
        id: 'chart',
        type: 'chart',
        adapterHint: 'highcharts.chart',
        props: { series: [] },
        i18n: { labelKey: 'runtime.revenue.chart.label' },
        accessibility: { ariaLabelKey: 'runtime.revenue.chart.aria', keyboardNav: true, focusOrder: 3 },
      },
      {
        id: 'customViz',
        type: 'custom',
        adapterHint: 'd3.custom',
        props: { height: 120 },
        i18n: { labelKey: 'runtime.customViz.label' },
        accessibility: { ariaLabelKey: 'runtime.customViz.aria', keyboardNav: true, focusOrder: 4 },
      },
    ];

    return {
      version: 'health',
      pageId: 'health-adapters',
      layout: {
        id: 'root',
        type: 'grid',
        columns: 1,
        componentIds: ['materialInput', 'ordersTable', 'chart', 'customViz'],
      },
      components,
    } satisfies UISchema;
  }, []);

  const i18n = useMemo(
    () =>
      createProviderFromBundles({
        locale: 'en',
        fallbackLocale: 'en',
        bundles: [...PLATFORM_BUNDLES, ...EXAMPLE_TENANT_BUNDLES],
        mode: 'dev',
      }),
    [],
  );

  const updateCheck = (id: string, patch: Partial<Check>) => {
    setChecks((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const run = async () => {
    setRouteDetails([]);
    setStoreHealth(null);
    setAdapterError(null);
    setAdapterMissingCount(null);

    setChecks((current) => current.map((c) => ({ ...c, status: 'pending', detail: undefined })));

    // Routes
    try {
      const origin = window.location.origin;
      const results = await Promise.all(
        routesToCheck.map(async (route) => {
          try {
            const res = await fetchWithTimeout(`${origin}${route}`, 12_000);
            return { path: route, status: res.status };
          } catch {
            return { path: route, status: null };
          }
        }),
      );
      setRouteDetails(results);
      const failed = results.filter((r) => r.status === null || r.status >= 400);
      updateCheck('routes', {
        status: failed.length === 0 ? 'pass' : 'fail',
        detail: failed.length === 0 ? `${results.length}/${results.length}` : `${results.length - failed.length}/${results.length}`,
      });
    } catch (error) {
      updateCheck('routes', { status: 'fail', detail: error instanceof Error ? error.message : String(error) });
    }

    // API
    let snap: ConsoleSnapshot | null = null;
    try {
      snap = await apiGet<ConsoleSnapshot>('/api/console');
      updateCheck('api', { status: 'pass', detail: `${snap.packages.length} package(s)` });
    } catch (error) {
      updateCheck('api', { status: 'fail', detail: error instanceof Error ? error.message : String(error) });
    }

    // Store
    try {
      const store = await apiGet<SystemHealthResponse>('/api/system/health');
      setStoreHealth(store);
      updateCheck('store', {
        status: store.canWriteToStore ? 'pass' : 'fail',
        detail: `${store.store.provider}${store.canWriteToStore ? '' : ' (fallback/no durable writes)'}`,
      });
    } catch (error) {
      updateCheck('store', { status: 'fail', detail: error instanceof Error ? error.message : String(error) });
    }

    // Adapters
    try {
      await runtimeAdapters.refresh();

      await new Promise((r) => window.setTimeout(r, 0));
      const missing = adapterTestRef.current?.querySelectorAll('[data-missing-adapter]').length ?? 0;
      setAdapterMissingCount(missing);
      const failedPacks = runtimeAdapters.failedAdapterPacks;
      const failedMessage =
        failedPacks.length > 0
          ? failedPacks.map((pack) => `${pack.packId}: ${pack.error ?? 'load error'}`).join(', ')
          : null;
      updateCheck('adapters', {
        status: missing === 0 && !adapterError && !failedMessage ? 'pass' : 'fail',
        detail: adapterError || failedMessage || (missing === 0 ? 'ok' : `${missing} missing`),
      });
    } catch (error) {
      updateCheck('adapters', { status: 'fail', detail: error instanceof Error ? error.message : String(error) });
    }

    // Flow execution
    try {
      const active = snap?.versions.find((v) => v.status === 'ACTIVE') ?? snap?.versions[0];
      if (!active) {
        updateCheck('flow', { status: 'fail', detail: 'No versions found' });
        return;
      }
      const resp = await apiGet<GetVersionResponse>(`/api/config-versions/${encodeURIComponent(active.id)}`);
      if (!resp.ok) throw new Error(resp.error);

      const flowRaw: FlowSchema = resp.version.bundle.flowSchema;
      const normalizedUiPages = normalizeUiPages({
        uiSchema: resp.version.bundle.uiSchema,
        uiSchemasById: resp.version.bundle.uiSchemasById,
        activeUiPageId: resp.version.bundle.activeUiPageId,
        flowSchema: flowRaw,
      });
      const flow = rebindFlowSchemaToAvailablePages(
        flowRaw,
        normalizedUiPages.uiSchemasById,
        normalizedUiPages.activeUiPageId,
      );
      if (!flow) throw new Error('Flow schema is missing');
      const uiSchemasById = normalizedUiPages.uiSchemasById;
      const rules: Rule[] = resp.version.bundle.rules.rules;
      const apiMappingsById: Record<string, ApiMapping> = resp.version.bundle.apiMappingsById ?? {};

      const step1 = await executeStep({
        flow,
        uiSchemasById,
        rules,
        apiMappingsById,
        stateId: flow.initialState,
        event: 'next',
        context: initialContext,
        data: initialData,
        fetchFn: demoFetch,
      });
      const step2 = await executeStep({
        flow,
        uiSchemasById,
        rules,
        apiMappingsById,
        stateId: step1.nextStateId,
        event: 'next',
        context: step1.updatedContext,
        data: step1.updatedData,
        fetchFn: demoFetch,
      });
      const step3 = await executeStep({
        flow,
        uiSchemasById,
        rules,
        apiMappingsById,
        stateId: step2.nextStateId,
        event: 'submit',
        context: step2.updatedContext,
        data: step2.updatedData,
        fetchFn: demoFetch,
      });

      const ok = step3.trace.flow.reason === 'ok' && (step3.trace.api?.response?.status ?? 0) === 200;
      updateCheck('flow', { status: ok ? 'pass' : 'fail', detail: ok ? 'ok' : `reason=${step3.trace.flow.reason}` });
    } catch (error) {
      updateCheck('flow', { status: 'fail', detail: error instanceof Error ? error.message : String(error) });
    }
  };

  useEffect(() => {
    void run();
  }, []);

  const reset = async () => {
    try {
      await apiPost('/api/system/reset');
      toast({ variant: 'success', title: 'Demo store reset' });
      await run();
    } catch (error) {
      toast({ variant: 'error', title: 'Reset failed', description: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className={styles.stack}>
      <Card>
        <CardHeader>
          <div className={styles.headerRow}>
            <CardTitle>System Health</CardTitle>
            <div className={styles.buttonRow}>
              <Button size="sm" variant="outline" onClick={() => void run()}>
                Re-run checks
              </Button>
              <Button size="sm" onClick={() => void reset()}>
                Reset demo store
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={styles.checksList}>
            {checks.map((check) => (
              <div key={check.id} className={styles.checkRow}>
                <div className={styles.checkText}>
                  <p className={styles.checkLabel}>{check.label}</p>
                  {check.detail ? <p className={styles.checkDetail}>{check.detail}</p> : null}
                </div>
                <Badge variant={check.status === 'pass' ? 'success' : check.status === 'fail' ? 'warning' : 'muted'}>
                  {check.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={styles.detailsStack}>
            <div>
              <p className={styles.sectionTitle}>Routes</p>
              <div className={styles.routesGrid}>
                {routeDetails.map((r) => (
                  <div key={r.path} className={styles.routeCard}>
                    <p className={styles.routePath}>{r.path}</p>
                    <p className={styles.routeStatus}>{r.status === null ? 'timeout/error' : `HTTP ${r.status}`}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className={styles.sectionTitle}>Adapters</p>
              <p className={styles.inlineStat}>
                Missing adapters:{' '}
                <span className={styles.inlineStatStrong}>
                  {adapterMissingCount === null ? '-' : String(adapterMissingCount)}
                </span>
                {adapterError ? (
                  <>
                    {' '}
                    - error: <span className={styles.inlineError}>{adapterError}</span>
                  </>
                ) : null}
              </p>
            </div>

            <div>
              <p className={styles.sectionTitle}>Store</p>
              <p className={styles.inlineStat}>
                canWriteToStore:{' '}
                <span className={styles.inlineStatStrong}>
                  {storeHealth ? (storeHealth.canWriteToStore ? 'true' : 'false') : '-'}
                </span>
              </p>
              <p className={styles.inlineStat}>
                provider: <span className={styles.inlineStatStrong}>{storeHealth?.store.provider ?? '-'}</span>
              </p>
              <p className={styles.inlineStat}>
                baseDir: <span className={styles.inlineStatStrong}>{storeHealth?.store.baseDir ?? '-'}</span>
              </p>
              {storeHealth?.store.warning ? <p className={styles.inlineError}>{storeHealth.store.warning}</p> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hidden render to detect missing adapters without impacting layout */}
      <div className="rfVisuallyHidden" aria-hidden="true">
        <ErrorBoundary onError={(e) => setAdapterError(e.message)}>
          <div ref={adapterTestRef}>
            <RenderPage uiSchema={adapterTestSchema} data={initialData} context={initialContext} i18n={i18n} />
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}
