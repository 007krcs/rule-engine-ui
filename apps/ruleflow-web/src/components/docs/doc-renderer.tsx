'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

const docComponents: Record<string, ComponentType> = {
  quickstart: dynamic(() => import('@/content/docs/quickstart.mdx')),
  concepts: dynamic(() => import('@/content/docs/concepts.mdx')),
  schemas: dynamic(() => import('@/content/docs/schemas.mdx')),
  adapters: dynamic(() => import('@/content/docs/adapters.mdx')),
  security: dynamic(() => import('@/content/docs/security.mdx')),
  wcag: dynamic(() => import('@/content/docs/wcag.mdx')),
  i18n: dynamic(() => import('@/content/docs/i18n.mdx')),
  deployment: dynamic(() => import('@/content/docs/deployment.mdx')),
};

export function DocRenderer({ slug }: { slug: string }) {
  const DocComponent = docComponents[slug];
  if (!DocComponent) {
    return null;
  }

  return <DocComponent />;
}
