import Link from 'next/link';
import { Card } from '@platform/component-system';
import { getDefaultComponentCatalog } from '@platform/component-system';
import styles from '../../components/studio/Studio.module.css';

const catalog = getDefaultComponentCatalog();
const groupedCatalog = groupByCategory(catalog);

export default function ComponentStudioHome() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.kicker}>Component Studio</span>
          <h1 className={styles.title}>Explore and Preview Components</h1>
          <p className={styles.description}>
            Inspect component contracts, tune props, and preview behavior without leaving the builder.
          </p>
        </div>
      </header>

      <div className={styles.catalogGrid}>
        {groupedCatalog.map(([category, components]) => (
          <section key={category} className={styles.categoryBlock}>
            <h2 className={styles.categoryTitle}>{category}</h2>
            <div className={styles.componentGrid}>
              {components.map((component) => (
                <Card
                  key={component.type}
                  title={component.displayName}
                  description={component.description ?? 'Component preview and configuration.'}
                  actions={
                    <Link
                      className={styles.linkButton}
                      href={`/studio/${encodeURIComponent(component.type)}`}
                    >
                      Open Studio
                    </Link>
                  }
                  variant="outline"
                >
                  <p className={styles.description}>Type: {component.type}</p>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupByCategory<T extends { category: string }>(items: T[]): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = item.category ?? 'Other';
    const list = map.get(key);
    if (list) {
      list.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return Array.from(map.entries()).sort((left, right) => left[0].localeCompare(right[0]));
}
