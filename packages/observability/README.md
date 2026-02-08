# Observability

Trace models and logging helpers for runtime, rules, and API execution.

Purpose
Provide standardized trace shapes and formatting for logs and dashboards.

Exports
- Trace interfaces for rules, flow, API, and runtime
- `formatRulesTrace`, `formatRuntimeTrace`, `logRulesTrace`, `logRuntimeTrace`

When to modify
Add new trace fields or logger integrations.

When not to touch
Do not break existing trace field names used by dashboards and audits.
