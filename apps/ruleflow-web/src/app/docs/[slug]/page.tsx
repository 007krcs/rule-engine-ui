import { notFound } from 'next/navigation';
import Link from 'next/link';
import { docsBySlug, docs } from '@/lib/docs';
import { Card, CardContent } from '@/components/ui/card';
import { DocRenderer } from '@/components/docs/doc-renderer';

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = docsBySlug[slug];
  if (!doc) return notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          {docs.map((item) => (
            <Link
              key={item.slug}
              className={item.slug === doc.slug ? 'font-semibold text-primary' : 'text-muted-foreground'}
              href={`/docs/${item.slug}`}
            >
              {item.title}
            </Link>
          ))}
        </CardContent>
      </Card>
      <article className="prose prose-slate max-w-none dark:prose-invert">
        <DocRenderer slug={doc.slug} />
      </article>
    </div>
  );
}
