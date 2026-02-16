import Link from 'next/link';
import {
  categoryLabels,
  categoryOrder,
  componentCatalog,
  getComponentsForCategory,
} from '@/lib/catalog';

export default function HomePage() {
  return (
    <div className="docs-section">
      <section className="docs-hero">
        <h1>Component Catalog</h1>
        <p>
          Platform UI Kit is a CSS-first, token-driven component system for schema-driven enterprise
          applications. Browse by category, inspect props, and copy implementation patterns.
        </p>
      </section>

      <section className="docs-grid" aria-label="Catalog categories">
        {categoryOrder.map((category) => {
          const components = getComponentsForCategory(category);
          return (
            <article key={category} className="docs-card">
              <h2 className="docs-card__title">
                <Link href={`/category/${category}`}>{categoryLabels[category]}</Link>
              </h2>
              <p className="docs-card__meta">{components.length} components</p>
              <div className="docs-link-grid">
                {components.slice(0, 4).map((component) => (
                  <Link key={component.slug} className="docs-link-card" href={`/components/${component.slug}`}>
                    <strong>{component.name}</strong>
                    <p>{component.summary}</p>
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="docs-panel">
        <h2>Catalog Coverage</h2>
        <p>
          {componentCatalog.length} components currently documented across Inputs, Data Display, Feedback,
          Surfaces, Navigation, Layout, and Utility primitives.
        </p>
      </section>
    </div>
  );
}
