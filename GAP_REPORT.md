# Gap Report (RuleFlow Platform Monorepo)

Date: 2026-02-10

This report lists remaining gaps vs the Principal Engineer requirements, plus evidence for what is already implemented.

## What Now Works End-To-End (New User Success)

The in-product experience supports the required beginner loop:

1. Clone a sample config (creates a DRAFT `versionId`)
2. Open Builder and modify UI (drag/drop, schema-driven props editor, validation)
3. Add a rule (starter rule button) and save
4. Run in Playground and view trace
5. Toggle Explain mode and see clause results + reads + action diffs

Evidence:
- Getting Started wizard: `apps/ruleflow-web/src/components/onboarding/onboarding-wizard.tsx`
- Samples gallery: `apps/ruleflow-web/src/components/onboarding/samples-gallery.tsx`, `/samples` route `apps/ruleflow-web/src/app/samples/page.tsx`
- Builder: `apps/ruleflow-web/src/app/builder/page.tsx`
- Rules Builder: `apps/ruleflow-web/src/app/builder/rules/page.tsx`
- Playground + Explain UI: `apps/ruleflow-web/src/components/playground/playground.tsx`
- E2E walkthrough: `apps/ruleflow-web/e2e/smoke.spec.ts` ("getting started wizard completes core walkthrough")

## 1) Guided Onboarding (In-Product)

- RESOLVED: Wizard is accessible from sidebar and header, has step-by-step actions, PASS/FAIL, and sample templates.
  - `apps/ruleflow-web/src/components/onboarding/onboarding-wizard.tsx`
  - State persisted in localStorage, url `versionId` sync: `apps/ruleflow-web/src/components/onboarding/onboarding-provider.tsx`

## 2) Create UI Upfront (Builder)

- RESOLVED: Drag/drop palette -> canvas, reorder, remove, schema-driven property panel, live preview.
  - Builder + DnD: `apps/ruleflow-web/src/app/builder/page.tsx`
  - Property editor generated from JSON Schema subset: `apps/ruleflow-web/src/components/builder/component-editor.tsx`

- RESOLVED: Preview Mode toggle with breakpoints.
  - `apps/ruleflow-web/src/app/builder/page.tsx`

- RESOLVED: “Rectify & Save” validation gate blocks save until issues fixed.
  - UI schema validation: `apps/ruleflow-web/src/app/builder/page.tsx` + `@platform/validator`
  - Issue focus jump: `apps/ruleflow-web/src/components/builder/schema-preview.tsx`

## 3) Component Registry System + Component Onboarding

- RESOLVED: Registry drives palette + prop editor (schema-driven).
  - Registry package: `packages/component-registry/src/index.ts`
  - Builder loads effective registry: `/api/component-registry` -> `apps/ruleflow-web/src/app/api/component-registry/route.ts`

- RESOLVED: Component Onboarding page validates and registers manifests.
  - UI: `apps/ruleflow-web/src/app/component-registry/page.tsx`

## 4) Custom Company Component Integration (Example Included)

- RESOLVED: `CompanyCustomAdapter` example with two components:
  - `company.currencyInput`
  - `company.riskBadge`
  - Adapter: `packages/adapters/react-company-adapter/src/index.tsx`

- RESOLVED: Samples use company components.
  - Templates: `apps/ruleflow-web/src/lib/samples.ts`
  - Seeding: `apps/ruleflow-web/src/server/demo/repository.ts` (checkout-flow, loan-onboarding)

## 5) Persistence By configId/version + Lifecycle + Audit

- PARTIALLY RESOLVED: Entities + lifecycle exist (DRAFT/REVIEW/APPROVED/ACTIVE/DEPRECATED/RETIRED) with audit log and approvals.
  - Repository: `apps/ruleflow-web/src/server/demo/repository.ts`
  - Console UI: `apps/ruleflow-web/src/app/console/page.tsx`

- GAP: Demo persistence is a local JSON store, not a real DB.
  - Store location: `.ruleflow-demo-data/` (configured by `RULEFLOW_DEMO_STORE_DIR` in tests)

## 6) Rules/Conditions Validation + Explain Mode

- RESOLVED: Rules Builder exists and validates RuleSet JSON; includes “Add starter rule” flow.
  - `apps/ruleflow-web/src/app/builder/rules/page.tsx`

- RESOLVED: Explain mode shows clause results, reads, and action diffs.
  - Trace types: `packages/observability/src/index.ts`
  - Engine explain capture: `packages/rules-engine/src/index.ts`
  - Playground UI: `apps/ruleflow-web/src/components/playground/playground.tsx`

- GAP: Date operators and locale-aware date parsing are not implemented yet (`before/after/on/between/plusDays`).
  - Engine ops: `packages/rules-engine/src/index.ts`
  - Schema ops: `packages/schema/src/types.ts`

## 7) Documentation (Beginner-Friendly)

- RESOLVED: In-product docs hub + tutorials + glossary/common mistakes/debugging.
  - Docs routes: `apps/ruleflow-web/src/app/docs/**`
  - Docs content: `apps/ruleflow-web/src/content/docs/*.mdx`
  - Search + registry: `apps/ruleflow-web/src/lib/docs.ts`, `apps/ruleflow-web/src/components/docs/*`

## 8) Responsive Layout + Breakpoint Verification

- RESOLVED: AppShell uses a fluid layout; a layout test page previews breakpoints.
  - AppShell: `apps/ruleflow-web/src/components/layout/app-shell.tsx`
  - Layout check: `apps/ruleflow-web/src/app/system/layout-check/page.tsx`

## 9) Angular + Vue Integration Completeness

- RESOLVED (minimal): Product Integration Hub shows React render and Angular/Vue HTML renderer outputs.
  - `apps/ruleflow-web/src/app/integrations/page.tsx`
  - Renderers: `packages/adapters/angular-renderer/src/index.ts`, `packages/adapters/vue-renderer/src/index.ts`

- GAP: These Angular/Vue packages are HTML renderers (not full framework component integration).

## 10) Testing

- RESOLVED: Unit tests added for core “supportive UX” primitives.
  - Component registry validation: `packages/component-registry/tests/component-registry.test.ts`
  - Rules explain mode trace: `packages/rules-engine/tests/rules-engine.test.ts`
  - Persistence lifecycle + GitOps: `apps/ruleflow-web/tests/demo-repository.test.ts`

- RESOLVED: Playwright e2e coverage for onboarding and the core loop.
  - `apps/ruleflow-web/e2e/smoke.spec.ts`
