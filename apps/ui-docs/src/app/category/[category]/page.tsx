import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  categoryLabels,
  categoryOrder,
  getComponentsForCategory,
  type CatalogCategory,
} from '@/lib/catalog';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export function generateStaticParams() {
  return categoryOrder.map((category) => ({ category }));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  if (!categoryOrder.includes(category as CatalogCategory)) {
    notFound();
  }

  const typedCategory = category as CatalogCategory;
  const components = getComponentsForCategory(typedCategory).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="docs-section">
      <section className="docs-hero">
        <h1>{categoryLabels[typedCategory]}</h1>
        <p>Reference examples, typed props, theming tokens, and accessibility requirements.</p>
      </section>

      <section className="docs-grid">
        {components.map((component) => (
          <article key={component.slug} className="docs-card">
            <h2 className="docs-card__title">
              <Link href={`/components/${component.slug}`}>{component.name}</Link>
            </h2>
            <p className="docs-card__meta">{component.summary}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
