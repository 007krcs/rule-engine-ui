# Enterprise Uplift Rollout Guide

This guide covers rollout for the end-to-end enterprise uplift delivered in RuleFlow.

## 1) Migration order

Run migrations in this sequence:

1. `0001_enterprise_core.sql`
2. `0002_tenant_rls.sql`
3. `0002_rls_and_guards.sql`
4. `0003_ui_pages.sql`

Apply via:

```bash
pnpm --filter @platform/persistence-postgres test
```

For app startup migration flow, ensure `DATABASE_URL` is set and the server process runs migration bootstrap.

## 2) Postgres RLS fail-closed requirements

- Set tenant context per request:
  - `SET LOCAL app.tenant_id = '<tenant-id>'`
- Without `app.tenant_id`, tenant-scoped table reads should be blocked by policy.
- Verify lifecycle writes are guarded:
  - only `DRAFT` is editable
  - submit only from `DRAFT`
  - strict approve/promote/rollback transitions

## 3) Multi-page UI schemas rollout

Bundle contract now supports:

- `uiSchemasById: Record<string, UISchema>`
- `activeUiPageId: string`

Backward compatibility remains:

- if only `uiSchema` exists, migration/normalizer maps it into `uiSchemasById`.

Operational checklist:

1. Deploy migration `0003_ui_pages.sql`.
2. Roll app.
3. Open Builder and verify page switcher behavior.
4. Run Playground and confirm `state.uiPageId` selects page correctly.

## 4) Policy enforcement and OPA composition

Policy flow:

1. Built-in policy checks always execute.
2. OPA is optional and executes when `OPA_URL` is configured.
3. Mutating routes must call shared `requirePolicy(stage)`.

Environment:

- `OPA_URL`
- `OPA_PACKAGE`
- `OPA_TIMEOUT_MS`

Rollout strategy:

1. Start with OPA disabled.
2. Deploy OPA policies in shadow mode (log decisions, do not deny).
3. Enable deny mode gradually by stage (`save`, `submit-for-review`, `approve`, `promote`).

## 5) Runtime controls (feature flags + kill switch)

Use `/api/runtime-flags` as the single client contract for effective controls.

Expected behavior:

- Builder save/submit blocked if kill switch active.
- Playground execution blocked if kill switch active.
- Palette groups/features gate off feature flags.

## 6) Adapter rollout (Material + runtime registry + Vue/Angular starters)

Runtime adapter strategy:

1. Register platform adapter as baseline.
2. Enable `material.*` only in tenants/environments that require it.
3. Use runtime adapter registry to control external adapter activation.

Vue/Angular starter renderers are HTML-based portability proofs and should be treated as non-production rendering backends until hydration strategy is finalized.

## 7) Observability rollout

Artifacts:

- `observability/grafana/provisioning/dashboards.yaml`
- `observability/grafana/dashboards/ruleflow-runtime.json`

Prometheus/Grafana checks:

1. `/api/metrics` emits valid `HELP`/`TYPE` lines.
2. Dashboard loads with UID `ruleflow-runtime-v1`.
3. Core queries return data:
   - `rate(api_call_count[5m])`
   - `histogram_quantile(0.95, sum by (le) (rate(api_latency_ms_bucket[5m])))`

## 8) Test and release gate

Recommended release gate commands:

```bash
pnpm --filter @platform/persistence-postgres test
pnpm --filter @platform/vue-renderer test
pnpm --filter @platform/angular-renderer test
pnpm --filter ruleflow-web typecheck
pnpm --filter ruleflow-web test
```

Note: if `ruleflow-web` unit tests time out in constrained CI workers, increase `vitest` timeout for long-running integration-style tests.
