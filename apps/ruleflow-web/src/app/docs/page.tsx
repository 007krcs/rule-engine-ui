import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsSearch } from '@/components/docs/docs-search';
import { docs } from '@/lib/docs';

export default function DocsPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {docs.map((doc) => (
            <Link key={doc.slug} className="block text-muted-foreground hover:text-foreground" href={`/docs/${doc.slug}`}>
              {doc.title}
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <DocsSearch />
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Explore the docs to learn about schemas, adapters, and enterprise governance.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {docs.map((doc) => (
                <Link key={doc.slug} href={`/docs/${doc.slug}`} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{doc.description}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}