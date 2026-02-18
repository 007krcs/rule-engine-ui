# RuleFlow Web

Next.js product UI for admin console, builder, docs, and playground.

Purpose
Provide the enterprise-facing experience for configuration governance and demos.

When to modify
Add new pages, dashboards, or builder workflows.

When not to touch
Do not remove navigation, docs routing, or accessibility styling without design review.

## Policy Enforcement

All mutating API routes run shared policy checks before executing repository writes.

- Built-in RBAC/policy checks always run.
- External OPA policy checks run when `OPA_URL` is configured.
- Policy stages used by routes: `save`, `submit-for-review`, `approve`, `promote`.

### OPA environment variables

- `OPA_URL`: Base OPA URL. Example: `http://localhost:8181`
- `OPA_PACKAGE`: OPA data path package. Example: `ruleflow/allow`
- `OPA_TIMEOUT_MS`: Request timeout in milliseconds (default `1500`)

Canonical policy input sent to built-ins and OPA:

```json
{
  "stage": "save",
  "tenantId": "tenant-1",
  "userId": "u-1",
  "roles": ["Author"],
  "currentBundle": {},
  "nextBundle": {},
  "metadata": {}
}
```

## Runtime Controls

Runtime controls are exposed through:

- `GET /api/runtime-flags?env=prod&versionId=...&packageId=...`

The response includes:

- effective feature flags for the tenant/env as a boolean map
- active kill switch state for the requested version/package

Builder and Playground consume this endpoint through `useRuntimeFlags()` and block save/submit/execute operations when a kill switch is active.

## OpenAPI Contract

Enterprise API contract starter:

- `apps/ruleflow-web/openapi/ruleflow-enterprise.yaml`

This includes governance, builder persistence, runtime controls, and observability endpoints.
