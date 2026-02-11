export type DocEntry = {
  slug: string;
  title: string;
  description: string;
  body: string;
};

export const docs: DocEntry[] = [
  {
    slug: 'quickstart',
    title: 'Quickstart',
    description: 'Install, render a UI schema, and execute a flow.',
    body: 'In-product onboarding wizard, clone a sample config, edit in Builder, add rules, run in Playground, inspect trace. Also: install/run, render a UI schema, execute a flow event.',
  },
  {
    slug: 'tutorial-console',
    title: 'Tutorial: Console + Versioning',
    description: 'Create configs, submit for review, approve, promote, and diff bundles.',
    body: 'Config lifecycle, approvals, audit log, GitOps export/import, schema diff viewer.',
  },
  {
    slug: 'tutorial-builder',
    title: 'Tutorial: Create UI Upfront (Builder)',
    description: 'Drag/drop from palette, edit props via JSON Schema, validate and save.',
    body: 'Component Registry-driven palette, schema-driven property panel, preview mode breakpoints, rectify-and-save.',
  },
  {
    slug: 'tutorial-rules',
    title: 'Tutorial: Rules + Explain Mode',
    description: 'Add rules safely (no eval) and understand why they fired.',
    body: 'RuleSet JSON, starter rule, validation, explain mode basics.',
  },
  {
    slug: 'tutorial-playground',
    title: 'Tutorial: Playground + Trace',
    description: 'Simulate runtime context and inspect flow/rules/API trace.',
    body: 'Context simulator, run events, trace panel, explain toggle, debugging.',
  },
  {
    slug: 'tutorial-component-registry',
    title: 'Tutorial: Component Registry',
    description: 'Register component manifests and unlock schema-driven forms.',
    body: 'Component manifest JSON, validation, tenant vs global scope, palette updates.',
  },
  {
    slug: 'tutorial-company-adapter',
    title: 'Tutorial: Add Your Company Component In 10 Minutes',
    description: 'Implement and register custom components using adapter hints.',
    body: 'company.currencyInput, company.riskBadge, registerCompanyAdapter, manifest registration, sample UI schema.',
  },
  {
    slug: 'tutorial-integrations',
    title: 'Tutorial: Embed In React / Angular / Vue',
    description: 'Framework-agnostic runtime + thin render adapters.',
    body: 'React renderer, Angular/Vue HTML renderers, adapter registration, host integration checklist.',
  },
  {
    slug: 'tutorial-theming',
    title: 'Tutorial: Theming + CSS Variables',
    description: 'Override design tokens safely and keep styling pluggable via adapters.',
    body: 'CSS variables, scoping strategy, optional CSS framework injection, common mistakes.',
  },
  {
    slug: 'concepts',
    title: 'Concepts',
    description: 'How flow, rules, and API orchestration fit together.',
    body: 'Flow engine, rules engine, API orchestrator, determinism, governance.',
  },
  {
    slug: 'schemas',
    title: 'Schemas',
    description: 'Versioned contracts for UI, flow, rules, and API mappings.',
    body: 'Schema contracts for UI, flow, rules, API mapping, validation.',
  },
  {
    slug: 'adapters',
    title: 'Adapters',
    description: 'Integrate any UI library using adapter hints.',
    body: 'Adapter registration, adapter hints, integration patterns.',
  },
  {
    slug: 'security',
    title: 'Security',
    description: 'Tenant isolation and safe-by-default execution.',
    body: 'Tenant isolation, audit trails, no eval, deterministic runtime.',
  },
  {
    slug: 'wcag',
    title: 'WCAG',
    description: 'Accessibility requirements and validation.',
    body: 'ariaLabelKey required, keyboardNav, focusOrder enforced.',
  },
  {
    slug: 'i18n',
    title: 'I18n',
    description: 'Translation packs, RTL support, and custom providers.',
    body: 'Translation packs, override precedence, RTL support.',
  },
  {
    slug: 'deployment',
    title: 'Deployment',
    description: 'Build and deploy RuleFlow across environments.',
    body: 'Build pipelines, GitOps export, promotion workflow.',
  },
  {
    slug: 'common-mistakes',
    title: 'Common Mistakes',
    description: 'Pitfalls new users hit in UI schemas, rules, and adapters.',
    body: 'Missing accessibility metadata, missing i18n keys, unknown adapter hints, invalid paths.',
  },
  {
    slug: 'debugging',
    title: 'Debugging',
    description: 'How to troubleshoot validation errors and runtime traces.',
    body: 'Validator output, trace inspection, rule failures, API mapping issues.',
  },
  {
    slug: 'glossary',
    title: 'Glossary',
    description: 'Short definitions for core RuleFlow terms.',
    body: 'UISchema, adapterHint, FlowSchema, RuleSet, ExecutionContext, GitOps bundle.',
  },
];

export const docsBySlug = Object.fromEntries(docs.map((doc) => [doc.slug, doc]));
