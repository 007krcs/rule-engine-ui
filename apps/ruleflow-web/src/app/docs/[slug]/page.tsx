import { notFound } from 'next/navigation';
import Link from 'next/link';
import { docsBySlug, docs } from '@/lib/docs';
import { Card, CardContent } from '@/components/ui/card';

export default function DocPage({ params }: { params: { slug: string } }) {
  const doc = docsBySlug[params.slug];
  if (!doc) return notFound();
  const DocComponent = doc.component;

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
        <DocComponent />
      </article>
    </div>
  );
}
