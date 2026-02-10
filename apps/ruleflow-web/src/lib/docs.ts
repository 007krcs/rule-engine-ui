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
];

export const docsBySlug = Object.fromEntries(docs.map((doc) => [doc.slug, doc]));
