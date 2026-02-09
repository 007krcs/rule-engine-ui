# Gap Report (RuleFlow Platform Monorepo)

Date: 2026-02-09

This report lists the **current gaps vs the Principal Engineer requirements** and points to the exact code locations.

## 1) Styling / UI Independence (Critical)

- **Tailwind CSS is still used across the product app (`ruleflow-web`).**
  - Evidence:
    - `apps/ruleflow-web/src/app/globals.css` contains `@tailwind` directives and `@apply`.
    - Most UI uses Tailwind utility `className` strings, e.g. `apps/ruleflow-web/src/components/layout/app-shell.tsx`, `apps/ruleflow-web/src/app/**/page.tsx`, `apps/ruleflow-web/src/components/ui/*`.
    - Tailwind build chain exists:
      - `apps/ruleflow-web/postcss.config.cjs` includes `tailwindcss`.
      - `apps/ruleflow-web/tailwind.config.ts` exists.
      - `apps/ruleflow-web/package.json` depends on `tailwindcss`, `tailwind-merge`, `@tailwindcss/typography`.
  - Impact:
    - Violates requirement: “UI shell must use ONLY first-party CSS (CSS modules/vanilla CSS + CSS variables). No Tailwind/Material UI.”

- **AppShell layout is not “fluid/responsive-first”; it is constrained to a fixed max width.**
  - Evidence:
    - `apps/ruleflow-web/src/components/layout/app-shell.tsx` uses fixed container widths (Tailwind `max-w-7xl`) and hard-coded sidebar width (`w-[260px]`), which makes the UI feel “stuck” to a certain width.

## 2) Builder: Drag/Drop + Canvas + Property Panel (Critical)

- **No real drag/drop exists.**
  - Evidence:
    - `apps/ruleflow-web/src/app/builder/page.tsx` uses click-to-add and move up/down buttons.
    - Palette items are buttons, not draggable items (`apps/ruleflow-web/src/app/builder/page.tsx`).

- **No true “Canvas” rendering of the schema.**
  - Evidence:
    - Builder “Canvas” is a list of `ComponentEditor` cards, not a live render of `UISchema`.
    - `RenderPage` (React renderer) is not used in Builder (it is used in Playground).
    - File: `apps/ruleflow-web/src/app/builder/page.tsx`

- **No select-to-edit property panel.**
  - Evidence:
    - Editing happens inline per component card (`apps/ruleflow-web/src/components/builder/component-editor.tsx`).
    - There is no dedicated “selected component” model and right-side property panel UX.

## 3) Rules: Validation + Explainability + Date Support (Critical)

- **No UI for building/validating rules or explaining pass/fail.**
  - Evidence:
    - There is no Rules editor/simulator route or panel in `apps/ruleflow-web/src/app`.
    - Current UI only validates `UISchema` via `@platform/validator` in Builder.

- **Rules engine has no date operators / date parsing support.**
  - Evidence:
    - Schema operator list lacks any date operators: `packages/schema/src/types.ts` `RuleOperator`.
    - Runtime evaluation only handles numbers/strings/arrays for a limited operator set: `packages/rules-engine/src/index.ts` `evalCondition`.
  - Impact:
    - Requirement: date comparisons and date parsing cannot be expressed or evaluated.

## 4) Persistence: DB + Entities + Lifecycle (Critical)

- **Persistence is JSON-file + in-memory, not a real DB (SQLite recommended).**
  - Evidence:
    - `apps/ruleflow-web/src/server/demo/repository.ts` persists to `.ruleflow-demo-data/store.json`.
  - Impact:
    - Requirement asks for SQLite or at least a DB-like repository with entities keyed by `configId+version+status` and tenant metadata.

- **Bundle signing is missing.**
  - Evidence:
    - `apps/ruleflow-web/src/app/api/gitops/export/route.ts` exports JSON without any signature.
    - `apps/ruleflow-web/src/app/api/gitops/import/route.ts` imports without signature verification.

## 5) Integrations: Angular/Vue “Real” Examples (Critical)

- **Integration Hub page is mostly snippets; it does not show working Angular/Vue renders.**
  - Evidence:
    - `apps/ruleflow-web/src/app/integrations/page.tsx` only prints code blocks.

- **Angular/Vue renderers exist but are not showcased in the product UI with a working example.**
  - Evidence:
    - Renderer packages:
      - `packages/adapters/angular-renderer/src/index.ts`
      - `packages/adapters/vue-renderer/src/index.ts`
    - No product-level page renders their output.

## 6) Docs: Newcomer Friendly End-to-End (Critical)

- **Docs do not cover an end-to-end guided demo + extension points.**
  - Evidence:
    - Root `README.md` explains concepts but does not provide a full guided walkthrough.
    - Product docs routes exist (`apps/ruleflow-web/src/app/docs/**`), but content does not yet meet the required sections (drag/drop internals, storage model, rules validation with examples, adding adapters, theming injection, Angular/Vue embedding).

## 7) Demo Requirements (Playground)

- **Demo bundle lacks a date picker component and date-based rules.**
  - Evidence:
    - Example UI schema `packages/schema/examples/example.ui.json` contains input/table/chart/custom, but no date picker.
    - Example rules `packages/schema/examples/example.rules.json` have no date conditions.

## 8) Testing Coverage (Mandatory)

- **No E2E test for drag/drop + property editing + rules simulation + persistence lifecycle.**
  - Evidence:
    - Existing Playwright suite `apps/ruleflow-web/e2e/smoke.spec.ts` covers navigation, console lifecycle, builder add/save (click-based), playground flow, export/import; no drag/drop or rules simulator coverage.

- **No unit tests for date operators.**
  - Evidence:
    - `packages/rules-engine/tests` do not include date comparisons/parsing cases.

