# RuleFlow Platform

RuleFlow is a headless, configurable UI + Flow + Rules platform for regulated enterprises. It separates business logic from host applications, enforces accessibility and i18n, and provides deterministic execution traces for auditability.

**1-Page Mental Model**

Problem
RuleFlow lets business teams change UI behavior, flow logic, and API orchestration without shipping code, while keeping compliance, accessibility, and auditability intact.

How data flows
UI input updates data, rules evaluate against context and data, flows transition between states, and API orchestration fetches or submits data.

ASCII data flow
```
UI Schema -> Renderer -> User Input
        |                |
        v                v
Rules Engine <--- Context/Data ---> Flow Engine
        |                |
        v                v
   Rule Actions      Flow Actions
        \                /
         v              v
          API Orchestrator
                 |
                 v
             Updated Data
```

**Big Picture Architecture**

```
Config Bundles (UI, Flow, Rules, API)
        |
        v
Validator -> Runtime -> Trace -> Observability
        |
        v
Host App (React / Angular / Vue / Custom)
```

**Key Concepts**

UI Schema
Declarative description of layout and components. The renderer interprets `adapterHint` to select the right UI adapter.

Flow
Finite state machine that chooses the next UI page based on events and guard conditions.

Rules
Deterministic conditions and actions that update data/context or emit events.

Context
Immutable execution metadata like tenant, role, locale, and device. Rules and flows evaluate against it.

**Getting Started In 30 Minutes**

1. Install dependencies
`pnpm install`

2. Run the product UI
`pnpm dev`

3. Run the React demo host
`pnpm demo:react`

Optional helper
`./run-app.sh dev` or `./run-app.sh demo`

4. Validate example schemas
`pnpm validate:configs`

**Folder-by-Folder Walkthrough**

Root
Purpose: monorepo orchestration, shared tooling, and workspace configuration.
When to modify: add scripts, update CI, or adjust workspace settings.
When not to touch: do not alter shared TypeScript or turbo config without updating all packages.
Full tree snapshot for QA is stored in `tree.txt`.

apps/builder-web
Purpose: schema builder UI and helper functions.
When to modify: new builder workflows or palette updates.
When not to touch: do not remove accessibility defaults or schema preview.

apps/demo-host-react
Purpose: end-to-end React host demo with runtime integration.
When to modify: add demo flows or adapter registrations.
When not to touch: do not remove trace output and runtime execution.

apps/demo-host-angular
Purpose: Angular-oriented demo host using HTML renderer.
When to modify: add Angular bootstrap or routing.
When not to touch: do not bypass validation or accessibility enforcement.

apps/demo-host-vue
Purpose: Vue-oriented demo host using HTML renderer.
When to modify: add Vue hydration or routing.
When not to touch: do not bypass validation or accessibility enforcement.

apps/ruleflow-web
Purpose: product UI for console, builder, docs, and playground.
When to modify: add pages, cards, or demos.
When not to touch: do not change routing or shared layout without review.

packages/schema
Purpose: TypeScript types and JSON schemas for all configuration.
When to modify: add versioned fields and update validators and examples.
When not to touch: do not change schema contracts without migration plan.

packages/validator
Purpose: schema, accessibility, and i18n validation.
When to modify: add new validation rules or stricter checks.
When not to touch: do not weaken accessibility enforcement.

packages/rules-engine
Purpose: deterministic rules evaluator with trace logs.
When to modify: add new operators or actions.
When not to touch: do not add dynamic code execution.

packages/flow-engine
Purpose: deterministic flow transitions and guard evaluation.
When to modify: add new transition actions.
When not to touch: do not introduce non-deterministic transitions.

packages/api-orchestrator
Purpose: declarative API mapping and response shaping.
When to modify: add transform functions or new protocol support.
When not to touch: do not allow unsafe transforms or paths.

packages/core-runtime
Purpose: orchestrates flow, rules, and API in a single step.
When to modify: add new runtime actions or trace hooks.
When not to touch: do not bypass validation or trace logging.

packages/i18n
Purpose: translation resolution, RTL detection, and caching.
When to modify: add new loaders or fallback strategies.
When not to touch: do not remove RTL handling.

packages/observability
Purpose: trace shapes and logging helpers.
When to modify: add new trace fields or logger integrations.
When not to touch: do not rename trace fields without migration.

packages/config-registry
Purpose: tenant-scoped versioning and rollback.
When to modify: add persistence or approval workflows.
When not to touch: do not bypass tenant isolation.

packages/adapters/*
Purpose: UI adapters and renderers for host integrations.
When to modify: add new adapter hints or rendering logic.
When not to touch: do not remove accessibility checks.

**Step-by-Step: Run The Demo**

1. Install dependencies
`pnpm install`

2. Start the React demo host
`pnpm --filter demo-host-react dev`

3. Open the UI and trigger flow events
Use the buttons to call `next`, `back`, and `submit`. Watch the trace panel update.

**Step-by-Step: Modify A Rule**

1. Open `packages/schema/examples/example.rules.json`
2. Change an action or condition
3. Run `pnpm demo:react` and trigger the event again

Before
```
{
  "ruleId": "ORDER_READY",
  "when": { "op": "gt", "left": { "path": "data.orderTotal" }, "right": { "value": 500 } },
  "actions": [{ "type": "setField", "path": "data.readyToSubmit", "value": true }]
}
```

After
```
{
  "ruleId": "ORDER_READY",
  "when": { "op": "gt", "left": { "path": "data.orderTotal" }, "right": { "value": 1000 } },
  "actions": [{ "type": "setField", "path": "data.readyToSubmit", "value": true }]
}
```

**Step-by-Step: Add A New UI Component**

1. Register an adapter in your host app
2. Add a component entry in a UI schema with `adapterHint`
3. Update the layout `componentIds` to include the new component id

**Step-by-Step: Add A New Country Rule**

1. Add a new rule with a scope filter
2. Use `scope.countries` with ISO country codes
3. Validate and run the flow

Example
```
{
  "ruleId": "FR_DISCOUNT",
  "scope": { "countries": ["FR"] },
  "when": { "op": "gt", "left": { "path": "data.orderTotal" }, "right": { "value": 100 } },
  "actions": [{ "type": "setField", "path": "data.discount", "value": 0.1 }]
}
```

**Step-by-Step: Add A New Language (I18n)**

1. Add a translation bundle for the locale
2. Register it in `PLATFORM_BUNDLES` or a tenant loader
3. Run `pnpm validate:configs` to confirm coverage

**Common Mistakes**

- Missing `ariaLabelKey` or `focusOrder` on UI components
- Forgetting to update layout `componentIds`
- Using unknown `adapterHint` prefixes
- Missing translation keys for a new locale

**Debugging Guide**

1. Rule traces
Use `logTraces: true` in `executeStep` or set `RULEFLOW_TRACE=1`.

2. Validation failures
Use `pnpm validate:configs` and review error paths.

3. Flow issues
Check `trace.flow.reason` and `trace.flow.errorMessage` in the runtime response.

**Test Commands**

- Run all tests: `pnpm test`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Validate schemas: `pnpm validate:configs`

**Learning Path For New Joiners**

1. Read this README end-to-end.
2. Open `packages/schema/examples` and inspect the example configs.
3. Run `pnpm demo:react` and review runtime traces.
4. Add a new rule and confirm the trace output changes.
5. Add a new adapter and render it in the demo host.

**Definition Of Done**

- No empty files or folders
- All packages have at least one unit test
- All public APIs are exercised by tests or demos
- Docs updated for any behavior change
- Accessibility validated (`validateUISchema`)
- I18n keys validated (`validateI18nCoverage`)
- Traces captured for flow, rules, and API

**Additional Resources**

- [Product Limitations](./LIMITATIONS.md) - Comprehensive list of current platform constraints and workarounds
- [Gap Report](./GAP_REPORT.md) - Status of feature gaps vs requirements
- [Enterprise Rollout Guide](./ENTERPRISE_ROLLOUT_GUIDE.md) - Production deployment guidance
- [New User Walkthrough](./NEW_USER_WALKTHROUGH.md) - Step-by-step onboarding guide
