import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsSearch } from '@/components/docs/docs-search';
import { docs } from '@/lib/docs';
import styles from './docs.module.css';

export default function DocsPage() {
  return (
    <div className={styles.layout}>
      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={styles.sidebarLinks}>
            {docs.map((doc) => (
              <Link key={doc.slug} className={styles.sidebarLink} href={`/docs/${doc.slug}`}>
                {doc.title}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className={styles.contentStack}>
        <DocsSearch />
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ margin: 0, color: 'var(--rf-muted)', fontSize: 14 }}>
              Explore the docs to learn about schemas, adapters, and enterprise governance.
            </p>
            <div style={{ height: 12 }} />
            <div className={styles.tiles}>
              {docs.map((doc) => (
                <Link key={doc.slug} href={`/docs/${doc.slug}`} className={styles.tile}>
                  <p className={styles.tileTitle}>{doc.title}</p>
                  <p className={styles.tileDesc}>{doc.description}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
