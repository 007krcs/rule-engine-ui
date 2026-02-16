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
