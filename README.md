# Headless Configurable UI+Flow+Rules Platform

This monorepo contains a headless runtime, rules engine, flow engine, schemas, adapters, and demo hosts.

## Prerequisites

- Node.js 18+
- pnpm 9+

## Install

```bash
pnpm install
```

If PowerShell execution policy blocks `pnpm`, use:

```bash
pnpm.cmd install
```

## Build

```bash
pnpm build
```

## Typecheck

```bash
pnpm typecheck
```

## Lint

```bash
pnpm lint
```

## Test

```bash
pnpm test
```

## Demo (React host)

```bash
pnpm demo:react
```

If PowerShell execution policy blocks `pnpm`, use:

```bash
pnpm.cmd demo:react
```

## Repo Structure

- apps/builder-web: React builder app (placeholder)
- apps/demo-host-react: sample host app + demo script
- apps/demo-host-angular: skeleton
- apps/demo-host-vue: skeleton
- packages/schema: contracts + JSON schemas + examples
- packages/core-runtime: orchestrator
- packages/rules-engine: safe rules evaluator
- packages/flow-engine: finite state machine executor
- packages/api-orchestrator: declarative API calls
- packages/observability: trace + audit models
- packages/validator: schema + WCAG validation
- packages/adapters/*: renderers and adapters
