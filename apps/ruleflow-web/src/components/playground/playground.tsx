'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiMapping, ExecutionContext, FlowSchema, JSONValue, Rule } from '@platform/schema';
import { executeStep } from '@platform/core-runtime';
import { RenderPage } from '@platform/react-renderer';
import { registerPlatformAdapter } from '@platform/react-platform-adapter';
import { registerMaterialAdapters } from '@platform/react-material-adapter';
import { registerAgGridAdapter } from '@platform/react-aggrid-adapter';
import { registerHighchartsAdapter } from '@platform/react-highcharts-adapter';
import { registerD3Adapter } from '@platform/react-d3-adapter';
import { registerCompanyAdapter } from '@platform/react-company-adapter';
import { createProviderFromBundles, EXAMPLE_TENANT_BUNDLES, PLATFORM_BUNDLES } from '@platform/i18n';
import type { ConditionExplain, ExplainOperand, RuleActionDiff, RuleRead } from '@platform/observability';
import type { ConfigVersion, ConsoleSnapshot } from '@/lib/demo/types';
import { apiGet } from '@/lib/demo/api-client';
import { useRuntimeFlags } from '@/lib/use-runtime-flags';
import { normalizeUiPages, rebindFlowSchemaToAvailablePages } from '@/lib/demo/ui-pages';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import styles from './playground.module.css';
import { useSearchParams } from 'next/navigation';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';

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
  loanAmount: 250000,
  riskLevel: 'Medium',
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

function renderValue(value: JSONValue | undefined): string {
  if (value === undefined) return 'undefined';
  // JSON.stringify gives quotes for strings and readable output for arrays/objects.
  return JSON.stringify(value);
}

function OperandView({ operand }: { operand: ExplainOperand }) {
  if (operand.kind === 'path') {
    return (
      <span className={styles.mono}>
        {operand.path}={renderValue(operand.value)}
      </span>
    );
  }
  return <span className={styles.mono}>{renderValue(operand.value)}</span>;
}

function ExplainNode({ explain, depth }: { explain: ConditionExplain; depth: number }) {
  const indent = Math.min(8, depth) * 14;

  if (explain.kind === 'compare') {
    return (
      <div className={styles.explainRow} style={{ paddingLeft: indent }}>
        <div className={styles.explainLeft}>
          <span className={styles.explainKind}>COMPARE</span>
          <span className={styles.mono}>{explain.op}</span>
          <OperandView operand={explain.left} />
          {explain.right ? <OperandView operand={explain.right} /> : null}
        </div>
        <span className={cn(styles.pill, explain.result ? styles.pillOk : styles.pillWarn)}>{String(explain.result)}</span>
      </div>
    );
  }

  if (explain.kind === 'not') {
    return (
      <>
        <div className={styles.explainRow} style={{ paddingLeft: indent }}>
          <div className={styles.explainLeft}>
            <span className={styles.explainKind}>NOT</span>
          </div>
          <span className={cn(styles.pill, explain.result ? styles.pillOk : styles.pillWarn)}>{String(explain.result)}</span>
        </div>
        <ExplainNode explain={explain.child} depth={depth + 1} />
      </>
    );
  }

  if (explain.kind === 'all' || explain.kind === 'any') {
    const kindLabel = explain.kind === 'all' ? 'ALL' : 'ANY';
    return (
      <>
        <div className={styles.explainRow} style={{ paddingLeft: indent }}>
          <div className={styles.explainLeft}>
            <span className={styles.explainKind}>{kindLabel}</span>
            <span className="rfHelperText" style={{ margin: 0 }}>
              ({explain.children.length} clause{explain.children.length === 1 ? '' : 's'})
            </span>
          </div>
          <span className={cn(styles.pill, explain.result ? styles.pillOk : styles.pillWarn)}>{String(explain.result)}</span>
        </div>
        <div className={styles.explainChildren}>
          {explain.children.map((child, idx) => (
            <ExplainNode key={`${kindLabel}-${idx}`} explain={child} depth={depth + 1} />
          ))}
        </div>
      </>
    );
  }

  return null;
}

function ExplainTree({ explain }: { explain: ConditionExplain }) {
  return (
    <div className={styles.explainTree}>
      <ExplainNode explain={explain} depth={0} />
    </div>
  );
}

function ReadsList({ reads }: { reads: RuleRead[] }) {
  if (!reads.length) return <p className="rfHelperText">No field reads recorded.</p>;
  return (
    <ul className={styles.kvList}>
      {reads.map((read) => (
        <li key={read.path} className={styles.kvItem}>
          <span className={styles.mono}>{read.path}</span>
          <span className={styles.kvValue}>{renderValue(read.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function ActionDiffsList({ diffs }: { diffs: RuleActionDiff[] }) {
  if (!diffs.length) return <p className="rfHelperText">No data/context changes recorded for this rule.</p>;
  return (
    <ul className={styles.kvList}>
      {diffs.map((diff, idx) => (
        <li key={`${diff.ruleId}-${diff.path}-${idx}`} className={styles.kvItem}>
          <span className={styles.mono}>
            {diff.action.type} {diff.target}.{diff.path}
          </span>
          <span className={styles.kvValue}>
            {renderValue(diff.before)} {'->'} {renderValue(diff.after)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Playground({
  initialSnapshot,
  initialVersion,
}: {
  initialSnapshot: ConsoleSnapshot;
  initialVersion: ConfigVersion | null;
}) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const onboarding = useOnboarding();
  const activeVersionId = onboarding.state.activeVersionId;
  const { setActiveVersionId, completeStep } = onboarding;

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
  const runtimeFlags = useRuntimeFlags({
    env: 'prod',
    versionId: selectedVersionId || undefined,
    packageId: version?.packageId,
  });
  const killSwitchActive = Boolean(selectedVersionId && runtimeFlags.killSwitch.active);
  const killSwitchReason =
    runtimeFlags.killSwitch.reason ?? 'This version is disabled by an active kill switch.';
  const effectiveContext = useMemo<ExecutionContext>(
    () => ({
      ...context,
      featureFlags: {
        ...context.featureFlags,
        ...runtimeFlags.featureFlags,
      },
    }),
    [context, runtimeFlags.featureFlags],
  );

  const traceFocusRef = useRef<HTMLDivElement | null>(null);
  const autoRunRef = useRef(false);

  useEffect(() => {
    registerPlatformAdapter();
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

  useEffect(() => {
    if (!selectedVersionId) return;
    if (activeVersionId === selectedVersionId) return;
    setActiveVersionId(selectedVersionId);
  }, [activeVersionId, selectedVersionId, setActiveVersionId]);

  const flowRaw: FlowSchema | null = version?.bundle.flowSchema ?? null;
  const rules: Rule[] = version?.bundle.rules.rules ?? [];
  const apiMappingsById: Record<string, ApiMapping> = version?.bundle.apiMappingsById ?? {};

  const normalizedUiPages = useMemo(
    () =>
      normalizeUiPages({
        uiSchema: version?.bundle.uiSchema,
        uiSchemasById: version?.bundle.uiSchemasById,
        activeUiPageId: version?.bundle.activeUiPageId,
        flowSchema: flowRaw,
      }),
    [flowRaw, version?.bundle.activeUiPageId, version?.bundle.uiSchema, version?.bundle.uiSchemasById],
  );
  const uiSchemasById = normalizedUiPages.uiSchemasById;
  const flow = useMemo(
    () =>
      rebindFlowSchemaToAvailablePages(
        flowRaw,
        uiSchemasById,
        normalizedUiPages.activeUiPageId,
      ),
    [flowRaw, normalizedUiPages.activeUiPageId, uiSchemasById],
  );

  const baseLocale = effectiveContext.locale.split('-')[0] ?? effectiveContext.locale;
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
  const currentUiSchema = currentState
    ? uiSchemasById[currentState.uiPageId] ??
      uiSchemasById[normalizedUiPages.activeUiPageId] ??
      Object.values(uiSchemasById)[0] ??
      null
    : uiSchemasById[normalizedUiPages.activeUiPageId] ?? Object.values(uiSchemasById)[0] ?? null;

  const runEvent = async (event: string) => {
    if (!flow || !currentUiSchema) return;
    if (killSwitchActive) {
      toast({
        variant: 'error',
        title: 'Execution blocked by kill switch',
        description: killSwitchReason,
      });
      return;
    }
    setBusy(true);
    try {
      let runtimeStateId = stateId;
      let runtimeContext = effectiveContext;
      let runtimeData = data;

      if (event === 'submit') {
        runtimeStateId = flow.initialState;
        const maxHops = Math.max(1, Object.keys(flow.states).length);
        for (let hop = 0; hop < maxHops; hop += 1) {
          const current = flow.states[runtimeStateId];
          if (!current) break;
          if (current.on.submit) break;
          if (!current.on.next) break;

          const autoAdvance = await executeStep({
            flow,
            uiSchemasById,
            rules,
            apiMappingsById,
            stateId: runtimeStateId,
            event: 'next',
            context: runtimeContext,
            data: runtimeData,
            killSwitch: { active: killSwitchActive, reason: killSwitchReason },
            fetchFn: demoFetch,
          });

          if (autoAdvance.trace.flow.reason !== 'ok') break;
          if (autoAdvance.nextStateId === runtimeStateId) break;
          runtimeStateId = autoAdvance.nextStateId;
          runtimeContext = autoAdvance.updatedContext;
          runtimeData = autoAdvance.updatedData as Record<string, JSONValue>;
        }
      }

      const result = await executeStep({
        flow,
        uiSchemasById,
        rules,
        apiMappingsById,
        stateId: runtimeStateId,
        event,
        context: runtimeContext,
        data: runtimeData,
        killSwitch: { active: killSwitchActive, reason: killSwitchReason },
        fetchFn: demoFetch,
      });
      setStateId(result.nextStateId);
      setContext({
        ...result.updatedContext,
        featureFlags: {
          ...result.updatedContext.featureFlags,
          ...runtimeFlags.featureFlags,
        },
      });
      setData(result.updatedData as Record<string, JSONValue>);
      setTrace(result.trace);

      const executionId = globalThis.crypto?.randomUUID?.() ?? `exec-${Date.now()}`;
      const correlationId = globalThis.crypto?.randomUUID?.() ?? executionId;
      await fetch('/api/execution-traces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          executionId,
          correlationId,
          versionId: version?.id,
          trace: result.trace,
        }),
      }).catch(() => undefined);
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

  useEffect(() => {
    if (!trace) return;
    completeStep('runPlayground');
  }, [completeStep, trace]);

  const focus = searchParams.get('focus');
  useEffect(() => {
    if (focus !== 'trace') return;
    // Allow layout to settle before scrolling.
    window.setTimeout(() => {
      traceFocusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [focus]);

  const autorun = searchParams.get('autorun');
  useEffect(() => {
    if (!autorun) return;
    if (autoRunRef.current) return;
    if (busy) return;
    if (!flow || !currentUiSchema) return;

    autoRunRef.current = true;
    void runEvent(autorun);
  }, [autorun, busy, currentUiSchema, flow, runEvent]);

  const reset = () => {
    if (!flow) return;
    setStateId(flow.initialState);
    setContext({
      ...initialContext,
      featureFlags: {
        ...initialContext.featureFlags,
        ...runtimeFlags.featureFlags,
      },
    });
    setData(initialData);
    setTrace(null);
  };

  return (
    <div className={styles.grid}>
      <Card>
        <CardHeader>
          <CardTitle>Context Simulator</CardTitle>
        </CardHeader>
        <CardContent className={styles.stack}>
          <div className={styles.field}>
            <label className="rfFieldLabel">Config Version</label>
            <Select
              value={selectedVersionId}
              onChange={(event) => setSelectedVersionId(event.target.value)}
              disabled={(snapshot?.versions.length ?? 0) === 0}
            >
              {(snapshot?.versions ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version} ({v.status})
                </option>
              ))}
            </Select>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className="rfFieldLabel">Role</label>
              <Input value={context.role} onChange={(event) => setContext({ ...context, role: event.target.value })} />
            </div>
            <div className={styles.field}>
              <label className="rfFieldLabel">Country</label>
              <Input
                value={context.country}
                onChange={(event) => setContext({ ...context, country: event.target.value as ExecutionContext['country'] })}
              />
            </div>
            <div className={styles.field}>
              <label className="rfFieldLabel">Device</label>
              <Select
                value={context.device}
                onChange={(event) => setContext({ ...context, device: event.target.value as ExecutionContext['device'] })}
              >
                <option value="desktop">Desktop</option>
                <option value="tablet">Tablet</option>
                <option value="mobile">Mobile</option>
              </Select>
            </div>
            <div className={styles.field}>
              <label className="rfFieldLabel">Locale</label>
              <Input value={context.locale} onChange={(event) => setContext({ ...context, locale: event.target.value })} />
            </div>
          </div>

          {killSwitchActive ? (
            <p className={styles.error} data-testid="playground-kill-warning">
              Execution blocked by kill switch. {killSwitchReason}
            </p>
          ) : null}

          <div className={styles.actions}>
            <Button size="sm" variant="outline" onClick={reset} disabled={busy}>
              Reset
            </Button>
            <Button size="sm" onClick={() => runEvent('back')} disabled={busy || !flow || killSwitchActive}>
              Back
            </Button>
            <Button size="sm" onClick={() => runEvent('next')} disabled={busy || !flow || killSwitchActive}>
              Next
            </Button>
            <Button size="sm" onClick={() => runEvent('submit')} disabled={busy || !flow || killSwitchActive}>
              Submit
            </Button>
          </div>

          <div className={styles.stateBox}>
            <p className={styles.stateRow} data-testid="playground-current-state">
              <span className={styles.stateKey}>State:</span> {stateId}
            </p>
            <p className={styles.stateRow} data-testid="playground-current-event">
              <span className={styles.stateKey}>Event:</span> {trace?.flow.event ?? '-'}
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
            <p className={styles.emptyText}>Select a config version to render.</p>
          ) : (
            <RenderPage
              uiSchema={currentUiSchema}
              data={data}
              context={effectiveContext}
              i18n={i18n}
              mode="controlled"
              onDataChange={setData}
              onContextChange={setContext}
            />
          )}
        </CardContent>
      </Card>

      <div ref={traceFocusRef} className={cn(focus === 'trace' ? styles.traceFocus : undefined)}>
        <TracePanel
          trace={trace}
          apiMappingsById={apiMappingsById}
          defaultExplain={searchParams.get('explain') === '1'}
        />
      </div>
    </div>
  );
}

function TracePanel({
  trace,
  apiMappingsById,
  defaultExplain,
}: {
  trace: RuntimeTrace | null;
  apiMappingsById: Record<string, ApiMapping>;
  defaultExplain?: boolean;
}) {
  const { completeStep } = useOnboarding();
  const [explain, setExplain] = useState<boolean>(() => Boolean(defaultExplain));

  useEffect(() => {
    if (!trace) return;
    completeStep('inspectTrace');
  }, [completeStep, trace]);

  if (!trace) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trace</CardTitle>
        </CardHeader>
        <CardContent className={styles.tracePanel}>
          <p className={styles.emptyText}>Run Back/Next/Submit to generate a trace.</p>
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
      <CardContent className={styles.tracePanel}>
        <div className={styles.traceBox}>
          <div className={styles.traceTitleRow}>
            <p className={styles.traceTitle}>Flow</p>
          </div>
          <p>
            <strong>{flow.event}</strong> - {flow.fromStateId} -&gt; {flow.toStateId} -{' '}
            <span className={flow.reason === 'ok' ? styles.ok : styles.warn}>{flow.reason}</span>
          </p>
          <p className="rfHelperText">
            uiPageId: <span className={styles.mono}>{flow.uiPageId}</span> - actions:{' '}
            {flow.actionsToRun.length ? flow.actionsToRun.join(', ') : 'none'}
          </p>
        </div>

        <div className={styles.traceBox}>
          <div className={styles.traceTitleRow}>
            <p className={styles.traceTitle}>Rules</p>
            <label className={styles.explainToggle} title="Show per-rule match results">
              <input type="checkbox" checked={explain} onChange={(e) => setExplain(e.target.checked)} />
              Explain
            </label>
          </div>
          {!rules ? (
            <p className="rfHelperText">Skipped</p>
          ) : (
            <>
              <p>
                Matched {rules.rulesMatched.length}/{rules.rulesConsidered.length} rules in {rules.durationMs}ms
              </p>
              {rules.rulesMatched.length > 0 ? <p className="rfHelperText">Hits: {rules.rulesMatched.join(', ')}</p> : null}
              {rules.actionsApplied.length > 0 ? (
                <p className="rfHelperText">
                  Actions: {rules.actionsApplied.map((applied) => `${applied.ruleId}:${applied.action.type}`).join(', ')}
                </p>
              ) : null}
              {rules.errors.length > 0 ? (
                <p className={cn('rfHelperText', styles.error)}>
                  Errors: {rules.errors.map((err) => err.message).join(' - ')}
                </p>
              ) : null}

              {explain ? (
                <ul className={styles.ruleList}>
                  {rules.rulesConsidered.map((ruleId) => {
                    const result = rules.conditionResults?.[ruleId] ?? false;
                    const matched = rules.rulesMatched.includes(ruleId);
                    const conditionExplain = rules.conditionExplains?.[ruleId];
                    const reads = rules.readsByRuleId?.[ruleId] ?? [];
                    const diffs = (rules.actionDiffs ?? []).filter((diff) => diff.ruleId === ruleId);
                    const applied = rules.actionsApplied.filter((applied) => applied.ruleId === ruleId);
                    const testId = `rule-explain-${ruleId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                    return (
                      <li key={`${trace.startedAt}-${ruleId}`} className={styles.ruleItem}>
                        <details data-testid={testId} className={styles.ruleDetails}>
                          <summary className={styles.ruleSummary}>
                            <div className={styles.ruleLeft}>
                              <span className={styles.mono}>{ruleId}</span>
                              <span>{matched ? 'Matched' : 'Not matched'}</span>
                            </div>
                            <div className={styles.ruleRight}>
                              <span
                                className={cn(styles.pill, result ? styles.pillOk : styles.pillWarn)}
                                title="Condition result"
                              >
                                {result ? 'true' : 'false'}
                              </span>
                            </div>
                          </summary>

                          <div className={styles.ruleBody}>
                            <div className={styles.ruleSection}>
                              <p className={styles.ruleSectionTitle}>Condition</p>
                              {conditionExplain ? (
                                <ExplainTree explain={conditionExplain} />
                              ) : (
                                <p className="rfHelperText">Explain details not available for this trace.</p>
                              )}
                            </div>

                            <div className={styles.ruleSection}>
                              <p className={styles.ruleSectionTitle}>Reads</p>
                              <ReadsList reads={reads} />
                            </div>

                            <div className={styles.ruleSection}>
                              <p className={styles.ruleSectionTitle}>Changes</p>
                              <ActionDiffsList diffs={diffs} />
                              {applied.length > 0 ? (
                                <p className="rfHelperText" style={{ marginTop: 10 }}>
                                  Applied actions: <span className={styles.mono}>{applied.map((a) => a.action.type).join(', ')}</span>
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </>
          )}
        </div>

        <div className={styles.traceBox}>
          <div className={styles.traceTitleRow}>
            <p className={styles.traceTitle}>API</p>
          </div>
          {!api ? (
            <p className="rfHelperText">Skipped</p>
          ) : (
            <>
              <p>
                {api.method} {api.endpoint}{' '}
                <span className={api.response?.status && api.response.status < 400 ? styles.ok : styles.warn}>
                  {api.response?.status ?? 'error'}
                </span>{' '}
                - {api.durationMs}ms
              </p>
              <p className="rfHelperText">
                mapping: <span className={styles.mono}>{apiMappingsById[api.apiId]?.apiId ?? api.apiId}</span>
              </p>
              {api.error ? <p className={cn('rfHelperText', styles.error)}>{api.error}</p> : null}
            </>
          )}
        </div>

        <details className={styles.details}>
          <summary className={styles.summary}>Raw JSON</summary>
          <pre className={styles.rawPre}>{JSON.stringify(trace, null, 2)}</pre>
        </details>
      </CardContent>
    </Card>
  );
}
