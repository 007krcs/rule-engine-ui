# Gap Report (RuleFlow Platform Monorepo)

Date: 2026-02-09

This report lists the current gaps vs the Principal Engineer requirements and points to the exact code locations.

## 1) Styling / UI Independence (Critical)

- RESOLVED (2026-02-09): Removed Tailwind from the product app (`apps/ruleflow-web`); UI uses first-party CSS variables + CSS modules.
  - Evidence:
    - `apps/ruleflow-web/src/app/globals.css` defines RuleFlow design tokens and base styles (no `@tailwind` / `@apply`).
    - `apps/ruleflow-web/postcss.config.cjs` no longer includes `tailwindcss`.
    - `apps/ruleflow-web/tailwind.config.ts` deleted.
    - `apps/ruleflow-web/package.json` no longer depends on `tailwindcss`, `tailwind-merge`, `@tailwindcss/typography`, or `class-variance-authority`.

- RESOLVED (2026-02-09): AppShell is fluid/responsive-first.
  - Evidence:
    - `apps/ruleflow-web/src/components/layout/app-shell.module.css` uses `width: min(1440px, 100% - padding)` and responsive sidebar/drawer behavior.
    - Playwright captures visual snapshots at 1280/1024/768/375 in `apps/ruleflow-web/e2e/smoke.spec.ts`.

- GAP: Host/theming adapter mechanism is not explicitly documented/implemented beyond CSS variables.
  - Evidence:
    - Tokens exist in `apps/ruleflow-web/src/app/globals.css`, but there is no dedicated "theme adapter" API nor a documented host CSS injection path.

## 2) Builder: Drag/Drop + Canvas + Property Panel (Critical)

- RESOLVED (2026-02-09): Real drag/drop exists (palette -> canvas, plus reorder within canvas).
  - Evidence:
    - `apps/ruleflow-web/src/app/builder/page.tsx` uses `@dnd-kit` with a droppable canvas and sortable canvas items.
    - E2E coverage: `apps/ruleflow-web/e2e/smoke.spec.ts` ("builder drag-drops palette component onto canvas").

- RESOLVED (2026-02-09): Live Canvas rendering is wired.
  - Evidence:
    - `apps/ruleflow-web/src/app/builder/page.tsx` renders `UISchema` via `RenderPage`.
    - Renderer respects grid `columns`: `packages/adapters/react-renderer/src/index.tsx`.

- RESOLVED (2026-02-09): Select-to-edit property panel exists.
  - Evidence:
    - Clicking a canvas component selects it and renders the editor in the right-side panel (`apps/ruleflow-web/src/app/builder/page.tsx`, `apps/ruleflow-web/src/components/builder/component-editor.tsx`).

## 3) Rules: Validation + Explainability + Date Support (Critical)

- GAP: No UI for building/validating rules or explaining pass/fail.
  - Evidence:
    - There is no rules editor/simulator route under `apps/ruleflow-web/src/app`.
    - Current UI only validates `UISchema` via `@platform/validator` in Builder.

- GAP: Rules engine has no date operators / date parsing support.
  - Evidence:
    - Operator list lacks date operators: `packages/schema/src/types.ts` `RuleOperator`.
    - Runtime evaluation only handles a limited operator set: `packages/rules-engine/src/index.ts` `evalCondition`.

## 4) Persistence: DB + Entities + Lifecycle (Critical)

- GAP: Persistence is JSON-file + in-memory, not a real DB (SQLite recommended).
  - Evidence:
    - `apps/ruleflow-web/src/server/demo/repository.ts` persists to `.ruleflow-demo-data/store.json`.

- RESOLVED (2026-02-09): Signed GitOps bundles (local HMAC) implemented.
  - Evidence:
    - `apps/ruleflow-web/src/server/demo/repository.ts` signs exports and verifies imports using `gitops-signing-key.txt` under `.ruleflow-demo-data/`.
    - `apps/ruleflow-web/src/app/api/gitops/export/route.ts` returns a signed bundle payload.
    - `apps/ruleflow-web/src/app/api/gitops/import/route.ts` rejects invalid/unsigned bundles.

## 5) Integrations: Angular/Vue Real Examples (Critical)

- GAP: Integration Hub page is mostly snippets; it does not show working Angular/Vue renders.
  - Evidence:
    - `apps/ruleflow-web/src/app/integrations/page.tsx` only prints code blocks.

- GAP: Angular/Vue renderers exist but are not showcased in the product UI with a working example.
  - Evidence:
    - Renderer packages:
      - `packages/adapters/angular-renderer/src/index.ts`
      - `packages/adapters/vue-renderer/src/index.ts`
    - No product-level page renders their output.

## 6) Docs: Newcomer Friendly End-to-End (Critical)

- GAP: Docs do not cover an end-to-end guided demo + extension points.
  - Evidence:
    - Root `README.md` does not provide a full guided walkthrough.
    - Product docs routes exist (`apps/ruleflow-web/src/app/docs/**`), but content does not yet meet required sections:
      - drag/drop internals
      - storage model
      - rules validation with examples
      - adding adapters
      - theming injection
      - Angular/Vue embedding

## 7) Demo Requirements (Playground)

- GAP: Demo bundle lacks a date picker component and date-based rules.
  - Evidence:
    - Example UI schema `packages/schema/examples/example.ui.json` contains input/table/chart/custom, but no date picker.
    - Example rules `packages/schema/examples/example.rules.json` have no date conditions.

## 8) Testing Coverage (Mandatory)

- GAP: No E2E test for drag/drop + property editing + rules simulation + persistence lifecycle.
  - Evidence:
    - Existing Playwright suite `apps/ruleflow-web/e2e/smoke.spec.ts` covers navigation, console lifecycle, builder add/save (click-based), playground flow, export/import; no drag/drop or rules simulator coverage.

- GAP: No unit tests for date operators.
  - Evidence:
    - `packages/rules-engine/tests` do not include date comparisons/parsing cases.
