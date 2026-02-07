import type { ComponentType } from 'react';

import Quickstart from '../content/docs/quickstart.mdx';
import Concepts from '../content/docs/concepts.mdx';
import Schemas from '../content/docs/schemas.mdx';
import Adapters from '../content/docs/adapters.mdx';
import Security from '../content/docs/security.mdx';
import Wcag from '../content/docs/wcag.mdx';
import I18n from '../content/docs/i18n.mdx';
import Deployment from '../content/docs/deployment.mdx';

export type DocEntry = {
  slug: string;
  title: string;
  description: string;
  component: ComponentType;
  body: string;
};

export const docs: DocEntry[] = [
  {
    slug: 'quickstart',
    title: 'Quickstart',
    description: 'Install, render a UI schema, and execute a flow.',
    component: Quickstart,
    body: 'Install and run RuleFlow, render a UI schema with adapters, execute a flow event.',
  },
  {
    slug: 'concepts',
    title: 'Concepts',
    description: 'How flow, rules, and API orchestration fit together.',
    component: Concepts,
    body: 'Flow engine, rules engine, API orchestrator, determinism, governance.',
  },
  {
    slug: 'schemas',
    title: 'Schemas',
    description: 'Versioned contracts for UI, flow, rules, and API mappings.',
    component: Schemas,
    body: 'Schema contracts for UI, flow, rules, API mapping, validation.',
  },
  {
    slug: 'adapters',
    title: 'Adapters',
    description: 'Integrate any UI library using adapter hints.',
    component: Adapters,
    body: 'Adapter registration, adapter hints, integration patterns.',
  },
  {
    slug: 'security',
    title: 'Security',
    description: 'Tenant isolation and safe-by-default execution.',
    component: Security,
    body: 'Tenant isolation, audit trails, no eval, deterministic runtime.',
  },
  {
    slug: 'wcag',
    title: 'WCAG',
    description: 'Accessibility requirements and validation.',
    component: Wcag,
    body: 'ariaLabelKey required, keyboardNav, focusOrder enforced.',
  },
  {
    slug: 'i18n',
    title: 'I18n',
    description: 'Translation packs, RTL support, and custom providers.',
    component: I18n,
    body: 'Translation packs, override precedence, RTL support.',
  },
  {
    slug: 'deployment',
    title: 'Deployment',
    description: 'Build and deploy RuleFlow across environments.',
    component: Deployment,
    body: 'Build pipelines, GitOps export, promotion workflow.',
  },
];

export const docsBySlug = Object.fromEntries(docs.map((doc) => [doc.slug, doc]));