# Deliverables Index

## 1) Gap Analysis

- `GAP_REPORT.md`

## 2) Product Limitations

- `LIMITATIONS.md`

## 3) Updated Repo Tree Snapshot

- `tree.txt`

## 4) Source Code (Changed/New)

All changed/new source is in the repo. Key entry points:

- Onboarding wizard: `apps/ruleflow-web/src/components/onboarding/onboarding-wizard.tsx`
- Samples gallery: `apps/ruleflow-web/src/components/onboarding/samples-gallery.tsx`
- Builder: `apps/ruleflow-web/src/app/builder/page.tsx`
- Rules Builder: `apps/ruleflow-web/src/app/builder/rules/page.tsx`
- Playground + Explain UI: `apps/ruleflow-web/src/components/playground/playground.tsx`
- Console + Diff Viewer + GitOps: `apps/ruleflow-web/src/app/console/page.tsx`
- Component Registry UI + API: `apps/ruleflow-web/src/app/component-registry/page.tsx`, `apps/ruleflow-web/src/app/api/component-registry/route.ts`
- Demo persistence + lifecycle + validation gates: `apps/ruleflow-web/src/server/demo/repository.ts`

## 5) Documentation Content

- Docs hub: `/docs` -> `apps/ruleflow-web/src/app/docs/page.tsx`
- Docs content: `apps/ruleflow-web/src/content/docs/*.mdx`
- Docs registry: `apps/ruleflow-web/src/lib/docs.ts`

Notable beginner docs:

- Quickstart: `apps/ruleflow-web/src/content/docs/quickstart.mdx`
- Builder: `apps/ruleflow-web/src/content/docs/tutorial-builder.mdx`
- Rules + Explain: `apps/ruleflow-web/src/content/docs/tutorial-rules.mdx`
- Playground + Trace: `apps/ruleflow-web/src/content/docs/tutorial-playground.mdx`
- Component registry: `apps/ruleflow-web/src/content/docs/tutorial-component-registry.mdx`
- Company adapter: `apps/ruleflow-web/src/content/docs/tutorial-company-adapter.mdx`
- Integrations: `apps/ruleflow-web/src/content/docs/tutorial-integrations.mdx`
- Theming: `apps/ruleflow-web/src/content/docs/tutorial-theming.mdx`
- Common mistakes / Debugging / Glossary: `apps/ruleflow-web/src/content/docs/common-mistakes.mdx`, `apps/ruleflow-web/src/content/docs/debugging.mdx`, `apps/ruleflow-web/src/content/docs/glossary.mdx`

Package README coverage:

- Root: `README.md`
- Adapters folder overview: `packages/adapters/README.md`
- Each package: `packages/*/README.md`

## 6) New User Walkthrough Script

- `NEW_USER_WALKTHROUGH.md`

## 7) Verification

Commands run:

- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter ruleflow-web build`
- `pnpm test:e2e`

Responsive verification:

- `/system/layout-check` -> `apps/ruleflow-web/src/app/system/layout-check/page.tsx`

