# @platform/persistence-postgres

Postgres-backed persistence layer for RuleFlow enterprise workflows.

## Purpose

- Store multi-tenant config packages and versions.
- Enforce tenant isolation using Postgres row-level security (RLS).
- Persist governance approvals, audit events, execution traces, feature flags, kill switches, and tenant branding.
- Provide a repository API usable by product APIs (`apps/ruleflow-web`) without coupling runtime logic to DB details.

## What is inside

- `migrations/`: SQL schema and RLS policies.
- `src/migrations.ts`: migration runner.
- `src/repository.ts`: tenant-aware repository API.
- `docker-compose.yml`: local Postgres for integration tests/dev.

### Migration order

- `0001_enterprise_core.sql`: base schema.
- `0002_tenant_rls.sql`: baseline tenant RLS policies.
- `0002_rls_and_guards.sql`: fail-closed hardening (strict tenant guard function, restrictive policies, privilege revokes).
- Migration runner behavior: numeric prefix order first; if two files share a prefix, lexicographically later file is applied last as a patch layer.

## Local dev

1. Start Postgres:
`docker compose -f packages/persistence-postgres/docker-compose.yml up -d`

2. Set environment:
`DATABASE_URL=postgresql://ruleflow:ruleflow@localhost:54329/ruleflow`

3. Apply migrations from app or script:
`await runPostgresMigrations({ connectionString: process.env.DATABASE_URL! })`

4. Ensure the Postgres driver is installed in the workspace:
`pnpm add -w pg`

## Design guardrails

- Every query is tenant scoped.
- RLS is enabled on tenant data tables.
- Repository methods always call `set_config('app.tenant_id', tenantId, true)` within transactions.
- Tenant-scoped queries fail closed when `app.tenant_id` is missing (`app_current_tenant_required()` raises an error).
- Lifecycle writes are guarded:
  - only `DRAFT` versions can be edited;
  - only `DRAFT` versions can be submitted for review;
  - approval decisions require `PENDING` approval + `REVIEW` version;
  - rollback targets must be `DEPRECATED`.
- Mutating repository operations write `audit_events` with consistent `metadata.stage` and contextual IDs (`packageId`, `versionId` where applicable).

## Integration tests

- `tests/repository.integration.test.ts`: end-to-end lifecycle persistence checks.
- `src/__tests__/rls.test.ts`: RLS tenant isolation, fail-closed tenant guard, lifecycle edit guard.
