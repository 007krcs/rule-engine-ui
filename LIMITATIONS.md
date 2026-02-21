# RuleFlow Platform Limitations

This document outlines the current limitations of the RuleFlow Platform. Understanding these constraints helps teams plan integrations and set appropriate expectations for production deployments.

---

## Table of Contents

1. [Framework Integration Limitations](#1-framework-integration-limitations)
2. [Rules Engine Limitations](#2-rules-engine-limitations)
3. [Persistence Limitations](#3-persistence-limitations)
4. [UI Builder Limitations](#4-ui-builder-limitations)
5. [API Orchestrator Limitations](#5-api-orchestrator-limitations)
6. [Flow Engine Limitations](#6-flow-engine-limitations)
7. [Internationalization (i18n) Limitations](#7-internationalization-i18n-limitations)
8. [Performance Constraints](#8-performance-constraints)
9. [Security Considerations](#9-security-considerations)
10. [Observability Limitations](#10-observability-limitations)
11. [Enterprise Feature Gaps](#11-enterprise-feature-gaps)
12. [Known Workarounds](#12-known-workarounds)

---

## 1. Framework Integration Limitations

### Angular Renderer
- **No component hydration**: Output is plain HTML string only; no Angular component hydration is available in the current package.
- **Host-driven events**: Event execution requires host application integration through the `dispatchEvent` API; no automatic DOM listeners are attached.
- **Limited layout support**: Only basic section/grid/stack/tabs layouts are supported. This is intended as a portability proof, not a production rendering backend.

### Vue Renderer
- **No component hydration**: Output is plain HTML string only; no Vue component hydration is available in the current package.
- **Host-driven events**: Same as Angular—event execution is host-driven through `dispatchEvent`; no automatic DOM listeners.
- **Limited layout support**: Basic section/grid/stack/tabs layouts only. Intended as a portability proof.

### React Adapter
- **Full support**: React is the primary supported framework with complete component hydration and event handling.

### General Framework Notes
- Vue/Angular starter renderers should be treated as **non-production rendering backends** until hydration strategy is finalized.

---

## 2. Rules Engine Limitations

### Operators
- **Date operators limited**: While `dateEq`, `dateBefore`, `dateAfter`, and `dateBetween` are implemented, the following are **not implemented yet**:
  - `before` / `after` / `on` (standalone temporal operators)
  - `plusDays` (date arithmetic)
  - Locale-aware date parsing (all dates are parsed as UTC)

### Execution Constraints
- **Timeout**: Default 50ms timeout for rules evaluation (configurable via `timeoutMs`)
- **Max rules**: Default limit of 1,000 rules per evaluation (configurable via `maxRules`)
- **Max depth**: Default limit of 10 levels of nested conditions (configurable via `maxDepth`)

### Dynamic Code
- **No dynamic code execution**: The rules engine is designed to be deterministic. Arbitrary JavaScript or `eval`-style expressions are intentionally blocked for security.

### Supported Operators
The following operators are currently supported:
- Comparison: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`
- Date: `dateEq`, `dateBefore`, `dateAfter`, `dateBetween`
- Collection: `in`, `contains`
- String: `startsWith`, `endsWith`
- Existence: `exists`
- Logical: `all`, `any`, `not`

### Action Types
Supported action types:
- `setField` - Set a data field value
- `setContext` - Set a context field value
- `throwError` - Throw an error and halt execution
- `emitEvent` - Emit an event for flow/host consumption
- `removeField` - Remove a field from data/context
- `addItem` - Add an item to an array
- `mapField` - Copy a value from one path to another

---

## 3. Persistence Limitations

### Demo Environment
- **Local JSON store**: The demo persistence is a local JSON file store (located at `.ruleflow-demo-data/` or `/tmp/.ruleflow-demo-data` for serverless environments), **not a production database**.
- **No horizontal scaling**: The demo store does not support multiple concurrent writers or distributed deployments.

### Postgres Persistence
- **Requires PostgreSQL**: Enterprise persistence requires PostgreSQL with row-level security (RLS) enabled.
- **Tenant context required**: Every query requires `app.tenant_id` to be set; queries fail closed without it.
- **Lifecycle constraints**:
  - Only `DRAFT` versions can be edited
  - Only `DRAFT` versions can be submitted for review
  - Approval decisions require `PENDING` approval + `REVIEW` version status
  - Rollback targets must be `DEPRECATED`

### Configuration Store
- **In-memory fallback**: When durable writes are unavailable (e.g., read-only filesystems), the system falls back to `InMemoryStore` which does **not persist across restarts**.

---

## 4. UI Builder Limitations

### Component Palette
- **Platform components only**: The default palette includes only platform-prefixed components (`platform.*`). Custom adapters must be registered separately.
- **No visual flow builder**: Flow diagrams must be defined in JSON; no drag-and-drop flow editor exists yet.

### Validation
- **Accessibility required**: All UI schemas must pass accessibility validation (`ariaLabelKey`, `focusOrder`). This cannot be disabled.
- **i18n coverage required**: All translation keys must have corresponding translations in all configured locales.

### Preview
- **Limited breakpoint support**: The preview mode supports basic breakpoints but may not perfectly represent all target device behaviors.
- **No live data binding**: Preview uses mock data; actual API responses are not available in preview mode.

### Layout
- Supported layouts: section, grid, stack, tabs
- **No custom layout engines**: Advanced layouts must be implemented via custom adapters.

---

## 5. API Orchestrator Limitations

### Transforms
- **No eval-style transforms**: Dynamic JavaScript transforms are intentionally blocked.
- **No unsafe path writes**: Path injection and prototype pollution are blocked.

### Protocols
- **HTTP/HTTPS only**: The API orchestrator supports HTTP-based APIs only. No direct support for:
  - GraphQL (requires REST wrapper)
  - gRPC
  - WebSocket
  - Message queues (Kafka, RabbitMQ, etc.)

### Response Handling
- **JSON responses only**: Response mapping assumes JSON payloads. Binary, XML, or other formats require custom transforms.

---

## 6. Flow Engine Limitations

### State Machine
- **Deterministic only**: All transitions must be deterministic based on current state and guards. No probabilistic or random transitions.
- **No history-based inference**: The engine does not maintain state history. Rollback must be explicitly defined as transitions.
- **No parallel states**: Only one active state at a time per flow instance.

### Transitions
- **Guard conditions required**: Ambiguous transitions (multiple valid transitions for the same event) are resolved by priority and lexicographic order.
- **No automatic timeouts**: Time-based transitions must be triggered by external timers.

---

## 7. Internationalization (i18n) Limitations

### RTL Support
- RTL (right-to-left) detection is supported, but:
  - Requires proper locale bundles
  - Some complex layouts may need manual RTL adjustments

### Translation Coverage
- **All keys required**: Every `ariaLabelKey`, `labelKey`, `placeholderKey`, etc., must have translations in all configured locales.
- **No automatic translation**: Translations must be provided; there is no machine translation fallback.

### Locale Bundles
- **Manual registration**: Platform bundles must be registered in `PLATFORM_BUNDLES` or via tenant loaders.
- **No dynamic loading**: All bundles must be available at initialization time.

---

## 8. Performance Constraints

### Rules Evaluation
| Constraint | Default Value | Configurable |
|------------|---------------|--------------|
| Timeout | 50ms | Yes (`timeoutMs`) |
| Max Rules | 1,000 | Yes (`maxRules`) |
| Max Condition Depth | 10 | Yes (`maxDepth`) |
| Path Cache Size | 500 entries | No |

### Bundle Size
- Large configuration bundles (100+ components, 1000+ rules) may impact:
  - Initial load time
  - Memory consumption
  - Validation duration

---

## 9. Security Considerations

### Code Execution
- **No `eval` or dynamic code**: All execution is schema-driven and deterministic.
- **Prototype pollution blocked**: Unsafe keys (`__proto__`, `constructor`, `prototype`) are rejected in path operations.

### Tenant Isolation
- **RLS required for production**: Postgres row-level security ensures tenant data isolation.
- **Fail-closed design**: Missing tenant context blocks all tenant-scoped operations.

### API Security
- **No credential storage**: API keys and secrets must be provided by the host application or environment.
- **No request signing**: OAuth, JWT, or custom signing must be handled by the host.

---

## 10. Observability Limitations

### Tracing
- **Schema-defined only**: Only traces defined in the schema types are captured.
- **No distributed tracing**: No automatic correlation with external APM systems (manual integration required).

### Metrics
- **Basic Prometheus format**: `/api/metrics` emits valid Prometheus format with:
  - `api_call_count`
  - `api_latency_ms` histogram
- **No custom metrics**: Additional metrics require host-level integration.

### Logging
- **JSON structured logs**: Logs are structured but may not include all context without explicit configuration.

---

## 11. Enterprise Feature Gaps

### Policy Engine
- **OPA optional**: Open Policy Agent integration is available but not enabled by default.
- **Shadow mode recommended**: Deploy OPA policies in shadow mode first (log decisions, do not deny).

### Feature Flags
- **Basic implementation**: Feature flags block UI features but may not have full rollout percentage support.
- **No A/B testing**: Feature flags are binary (on/off) without traffic splitting.

### Kill Switch
- **Global only**: Kill switches affect all users when active; no user-level or tenant-level granularity.

### Multi-page UI Schemas
- **Backward compatible**: Older single-page schemas are auto-migrated but may miss some multi-page features.

---

## 12. Known Workarounds

### Angular/Vue Production Use
1. Use the HTML renderer output as a base
2. Implement host-side hydration
3. Register event handlers manually through `dispatchEvent`

### Date Arithmetic
For `plusDays` or similar:
1. Compute dates in the host application
2. Pass computed values as data/context
3. Use `dateAfter`/`dateBefore` for comparison

### GraphQL APIs
1. Create a REST wrapper endpoint
2. Map GraphQL queries as REST POST bodies
3. Use API orchestrator with the REST wrapper

### Complex Layouts
1. Create a custom adapter
2. Register with the component registry
3. Use `adapterHint` to route to your adapter

---

## Future Roadmap Items

The following items are planned but not yet implemented:

- [ ] Full Angular component hydration
- [ ] Full Vue component hydration
- [ ] Visual flow builder (drag-and-drop)
- [ ] Locale-aware date parsing
- [ ] Date arithmetic operators (`plusDays`, `minusDays`)
- [ ] GraphQL protocol support
- [ ] Distributed tracing integration
- [ ] Feature flag rollout percentages
- [ ] Tenant-level kill switches

---

## Getting Help

If you encounter a limitation that blocks your use case:

1. Check the [GAP_REPORT.md](./GAP_REPORT.md) for known gaps and their status
2. Review [Common Mistakes](./apps/ruleflow-web/src/content/docs/common-mistakes.mdx) documentation
3. Consult the [Debugging Guide](./apps/ruleflow-web/src/content/docs/debugging.mdx)
4. Open an issue with your specific use case

---

*Last updated: 2026-02-21*
