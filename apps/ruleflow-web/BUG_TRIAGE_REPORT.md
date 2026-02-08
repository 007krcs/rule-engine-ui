# Bug Triage Report (RuleFlow Web)

Date: 2026-02-08

Scope: This report focuses on the Next.js product app in `apps/ruleflow-web` (the UI surfaced by `pnpm dev`). I also scanned the repo for other UI entrypoints (`apps/builder-web`, `apps/demo-host-react`) to capture additional buttons that exist outside the product web app.

## Route / Page Inventory

### `apps/ruleflow-web` (Next.js App Router)

- `/` `apps/ruleflow-web/src/app/page.tsx`
- `/console` `apps/ruleflow-web/src/app/console/page.tsx`
- `/builder` `apps/ruleflow-web/src/app/builder/page.tsx`
- `/playground` `apps/ruleflow-web/src/app/playground/page.tsx` (renders `apps/ruleflow-web/src/components/playground/playground.tsx`)
- `/docs` `apps/ruleflow-web/src/app/docs/page.tsx`
- `/docs/[slug]` `apps/ruleflow-web/src/app/docs/[slug]/page.tsx` (slugs from `apps/ruleflow-web/src/lib/docs.ts`)
- `/integrations` `apps/ruleflow-web/src/app/integrations/page.tsx`

Routes referenced by navigation but not actually implemented as distinct screens:

- `/console?tab=governance` (sidebar “Governance”)
- `/console?tab=observability` (sidebar “Observability”)
- `/console?tab=versions` (sidebar “Versions”)

Routes required by spec but missing:

- `/system/health`
- `/system/roadmap`

### Other UI Entry Points (Non-Next)

- `apps/builder-web/src/index.tsx` (buttons: “Add component”, “Remove”)
- `apps/demo-host-react/src/App.tsx` (buttons: “Back”, “Next”, “Submit”)

## Component Inventory (`apps/ruleflow-web/src/components`)

- Builder
  - `apps/ruleflow-web/src/components/builder/component-editor.tsx`
  - `apps/ruleflow-web/src/components/builder/schema-preview.tsx`
- Console
  - `apps/ruleflow-web/src/components/console/audit-item.tsx`
  - `apps/ruleflow-web/src/components/console/metric-card.tsx`
- Docs
  - `apps/ruleflow-web/src/components/docs/doc-renderer.tsx`
  - `apps/ruleflow-web/src/components/docs/docs-search.tsx`
- Layout
  - `apps/ruleflow-web/src/components/layout/app-shell.tsx`
  - `apps/ruleflow-web/src/components/layout/breadcrumbs.tsx`
  - `apps/ruleflow-web/src/components/layout/theme-provider.tsx`
  - `apps/ruleflow-web/src/components/layout/theme-toggle.tsx`
- Playground
  - `apps/ruleflow-web/src/components/playground/playground.tsx`
- UI primitives
  - `apps/ruleflow-web/src/components/ui/badge.tsx`
  - `apps/ruleflow-web/src/components/ui/button.tsx`
  - `apps/ruleflow-web/src/components/ui/card.tsx`
  - `apps/ruleflow-web/src/components/ui/input.tsx`

## Clickable Elements Triage (Product Web App)

Legend:

- Expected behavior: what a reasonable user expects from the label and context.
- Current behavior: what the code currently does.
- Fix: what needs implementing to avoid dead/stubbed UI.

### Global Shell / Navigation

- Header: **Export GitOps** (`apps/ruleflow-web/src/components/layout/app-shell.tsx:51`)
  - Expected: Download a GitOps JSON bundle for the current tenant/config registry state.
  - Current: No handler; button is clickable but does nothing.
  - Fix: Wire to `GET /api/gitops/export` and trigger a file download; show toast on success/failure.

- Header: **New Config** (`apps/ruleflow-web/src/components/layout/app-shell.tsx:54`)
  - Expected: Create a new DRAFT config package/version and navigate to Builder for editing.
  - Current: No handler; button does nothing.
  - Fix: Open modal (name/version), call `POST /api/configs`, navigate to `/builder?configId=...`.

- Mobile header: **New** (`apps/ruleflow-web/src/components/layout/app-shell.tsx:122`)
  - Expected: Same as “New Config”.
  - Current: No handler.
  - Fix: Same as above.

- Sidebar: **System → Governance/Observability/Versions** (`apps/ruleflow-web/src/components/layout/app-shell.tsx:28-32`)
  - Expected: Show distinct screens or distinct Console tabs matching the label.
  - Current: Links include `?tab=...` but `/console` ignores search params; content doesn’t change.
  - Fix: Implement Console tab routing/rendering based on `searchParams.tab` (or replace with dedicated routes).

### Home (`/`)

- **Explore Console** (`apps/ruleflow-web/src/app/page.tsx:42`)
  - Expected: Navigate to `/console`.
  - Current: No handler; does nothing.
  - Fix: Make it a `Link` or `router.push('/console')`.

### Console (`/console`)

All buttons below are currently “dead” because the page renders static `mock-data` and does not wire actions.

- **Diff** (`apps/ruleflow-web/src/app/console/page.tsx:62`)
  - Expected: Show version diff vs active (or previous) config bundle; allow export of diff.
  - Current: No handler.
  - Fix: Implement bundle diff (deep JSON diff), render modal panel; source data from local repo store.

- **Promote** (`apps/ruleflow-web/src/app/console/page.tsx:65`)
  - Expected: Promote a config through lifecycle (e.g., APPROVED → ACTIVE) with audit event.
  - Current: No handler.
  - Fix: Implement lifecycle transitions in repo + API (`POST /api/configs/:id/promote`) and refresh UI.

- Approval queue: **Approve** (`apps/ruleflow-web/src/app/console/page.tsx:87`)
  - Expected: Approve pending request; move config REVIEW → APPROVED; write audit event; update queue.
  - Current: No handler.
  - Fix: Implement approval action in repo + API (`POST /api/approvals/:id/approve`) and refresh UI.

- Approval queue: **Request changes** (`apps/ruleflow-web/src/app/console/page.tsx:88`)
  - Expected: Mark request as changes requested; move config REVIEW → DRAFT (or CHANGES_REQUESTED); audit.
  - Current: No handler.
  - Fix: Implement in repo + API (`POST /api/approvals/:id/request-changes`) and refresh UI.

- GitOps: **Export** (`apps/ruleflow-web/src/app/console/page.tsx:123`)
  - Expected: Download GitOps bundle JSON.
  - Current: No handler.
  - Fix: Same as header export.

- GitOps: **Import** (`apps/ruleflow-web/src/app/console/page.tsx:124`)
  - Expected: Upload GitOps bundle JSON; validate; apply to local store; audit.
  - Current: No handler.
  - Fix: Implement file picker + `POST /api/gitops/import` + error handling/toasts.

### Builder (`/builder`)

- Palette item buttons (`apps/ruleflow-web/src/app/builder/page.tsx:117`)
  - Expected: Set the “adapterHint” for the next component draft.
  - Current: Works.
  - Fix: Add affordance for active selection; keep.

- **Add** (`apps/ruleflow-web/src/app/builder/page.tsx:145`)
  - Expected: Add a component; show feedback if invalid/duplicate; update preview/errors.
  - Current: Adds silently; invalid/duplicate silently no-ops.
  - Fix: Add toasts for validation; disable/tooltip when invalid; integrate save to config package.

- Component editor: **Remove** (`apps/ruleflow-web/src/components/builder/component-editor.tsx:87`)
  - Expected: Remove component from schema.
  - Current: Works.
  - Fix: Add optional confirm; integrate audit/save when wired to repo.

Missing builder capabilities per spec:

- Reorder components (drag/drop or click-to-reorder): not implemented.
- Field-mapped validation errors: issues only shown in preview panel, not attached to specific fields.

### Playground (`/playground`)

- **Flow select** (`apps/ruleflow-web/src/components/playground/playground.tsx`)
  - Expected: Selecting a flow changes the runtime bundle and resets state.
  - Current: Updates `selectedFlow` state, but selection is not used; flow never changes.
  - Fix: Load bundle by selected flow/config; reset `stateId`, `data`, `trace` accordingly.

- **Back / Next / Submit**
  - Expected: Drive flow transitions via `executeStep` and show trace.
  - Current: Calls `executeStep`, but the mocked `fetchFn` does not return a `Response` (missing `return`), so API calls can hang or silently fail.
  - Fix: Correct `fetchFn` to return a `Response`; surface API trace/errors in the trace panel.

- Trace panel
  - Expected: Summaries for flow transitions, rule hits, and API calls.
  - Current: Raw JSON dump only.
  - Fix: Implement structured trace viewer + copy-to-clipboard; keep raw JSON as fallback.

### Docs (`/docs`, `/docs/[slug]`)

- Sidebar links and search links appear wired and should navigate correctly.
- Risk: Code blocks and `<pre>` sections can overflow on small viewports.
  - Fix: Ensure `pre` has horizontal scrolling (`overflow-x-auto`) and consistent container padding.

### Integrations (`/integrations`)

- Code snippets rendered in `<pre>` without overflow handling.
  - Fix: Add `overflow-auto` and prevent layout break on mobile.

## Layout Consistency / Responsiveness Issues

- App shell uses `sticky` header with body scroll, but spec calls for a single AppShell with fixed header/sidebar and a dedicated main scroll region.
- Mobile experience: sidebar collapses into the page flow (above main) instead of a drawer; can be improved to avoid excessive vertical scroll at 375px.
- Code blocks/snippets lack consistent overflow handling.

## Missing Test Coverage

- No Playwright e2e coverage for navigation, console actions, builder, or playground.
- No unit tests for lifecycle transitions, approvals, export/import, or diff.

