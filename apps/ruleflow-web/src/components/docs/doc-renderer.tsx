'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

const docComponents: Record<string, ComponentType> = {
  quickstart: dynamic(() => import('@/content/docs/quickstart.mdx')),
  'tutorial-console': dynamic(() => import('@/content/docs/tutorial-console.mdx')),
  'tutorial-builder': dynamic(() => import('@/content/docs/tutorial-builder.mdx')),
  'tutorial-rules': dynamic(() => import('@/content/docs/tutorial-rules.mdx')),
  'tutorial-playground': dynamic(() => import('@/content/docs/tutorial-playground.mdx')),
  'tutorial-component-registry': dynamic(() => import('@/content/docs/tutorial-component-registry.mdx')),
  'tutorial-company-adapter': dynamic(() => import('@/content/docs/tutorial-company-adapter.mdx')),
  'tutorial-integrations': dynamic(() => import('@/content/docs/tutorial-integrations.mdx')),
  'tutorial-theming': dynamic(() => import('@/content/docs/tutorial-theming.mdx')),
  concepts: dynamic(() => import('@/content/docs/concepts.mdx')),
  schemas: dynamic(() => import('@/content/docs/schemas.mdx')),
  adapters: dynamic(() => import('@/content/docs/adapters.mdx')),
  security: dynamic(() => import('@/content/docs/security.mdx')),
  wcag: dynamic(() => import('@/content/docs/wcag.mdx')),
  i18n: dynamic(() => import('@/content/docs/i18n.mdx')),
  deployment: dynamic(() => import('@/content/docs/deployment.mdx')),
  'common-mistakes': dynamic(() => import('@/content/docs/common-mistakes.mdx')),
  debugging: dynamic(() => import('@/content/docs/debugging.mdx')),
  glossary: dynamic(() => import('@/content/docs/glossary.mdx')),
};

export function DocRenderer({ slug }: { slug: string }) {
  const DocComponent = docComponents[slug];
  if (!DocComponent) {
    return null;
  }

  return <DocComponent />;
}
