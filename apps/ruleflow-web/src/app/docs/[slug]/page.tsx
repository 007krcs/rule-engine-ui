import { notFound } from 'next/navigation';
import Link from 'next/link';
import { docsBySlug, docs } from '@/lib/docs';
import { Card, CardContent } from '@/components/ui/card';
import { DocRenderer } from '@/components/docs/doc-renderer';
import styles from '../docs.module.css';

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = docsBySlug[slug];
  if (!doc) return notFound();

  return (
    <div className={styles.layout}>
      <Card>
        <CardContent>
          <div className={styles.sidebarLinks}>
            {docs.map((item) => (
              <Link
                key={item.slug}
                className={item.slug === doc.slug ? `${styles.sidebarLink} ${styles.sidebarActive}` : styles.sidebarLink}
                href={`/docs/${item.slug}`}
              >
                {item.title}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className={styles.articleWrap}>
          <article className="rfProse">
            <DocRenderer slug={doc.slug} />
          </article>
        </CardContent>
      </Card>
    </div>
  );
}
