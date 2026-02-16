import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ComponentLiveExample } from '@/components/component-live-example';
import { componentCatalog, getComponentDoc, categoryLabels } from '@/lib/catalog';

interface ComponentPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return componentCatalog.map((component) => ({ slug: component.slug }));
}

export default async function ComponentPage({ params }: ComponentPageProps) {
  const { slug } = await params;
  const component = getComponentDoc(slug);
  if (!component) notFound();

  return (
    <div className="docs-section">
      <section className="docs-hero">
        <h1>{component.name}</h1>
        <p>{component.summary}</p>
        <p>
          Category:{' '}
          <Link href={`/category/${component.category}`}>
            {categoryLabels[component.category]}
          </Link>
        </p>
      </section>

      <section className="docs-panel">
        <h2>Example</h2>
        <pre className="docs-code">{component.exampleSnippet}</pre>
        <div className="docs-live-example">
          <ComponentLiveExample slug={component.slug} />
        </div>
      </section>

      <section className="docs-panel">
        <h2>Props</h2>
        <table className="docs-table">
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {component.props.map((prop) => (
              <tr key={prop.name}>
                <td>
                  <code>{prop.name}</code>
                </td>
                <td>
                  <code>{prop.type}</code>
                </td>
                <td>{prop.defaultValue ? <code>{prop.defaultValue}</code> : '-'}</td>
                <td>{prop.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="docs-panel">
        <h2>Theming Hooks</h2>
        <ul className="docs-inline-list">
          {component.tokens.map((token) => (
            <li key={token}>
              <code>{token}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="docs-panel">
        <h2>Accessibility Checklist</h2>
        <ul className="docs-checklist">
          {component.accessibility.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
