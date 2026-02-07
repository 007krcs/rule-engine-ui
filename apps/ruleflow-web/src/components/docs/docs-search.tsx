'use client';

import { useMemo, useState } from 'react';
import lunr from 'lunr';
import Link from 'next/link';
import { docs } from '@/lib/docs';
import { Input } from '@/components/ui/input';

export function DocsSearch() {
  const [query, setQuery] = useState('');

  const index = useMemo(() => {
    return lunr(function () {
      this.ref('slug');
      this.field('title');
      this.field('body');
      docs.forEach((doc) => this.add(doc));
    });
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    try {
      return index.search(`${query}*`).map((result) => docs.find((doc) => doc.slug === result.ref));
    } catch {
      return [];
    }
  }, [index, query]);

  return (
    <div className="space-y-3">
      <Input placeholder="Search docs" value={query} onChange={(event) => setQuery(event.target.value)} />
      {query && (
        <div className="rounded-xl border border-border bg-surface p-3 text-sm">
          {results.length === 0 && <p className="text-muted-foreground">No results.</p>}
          <ul className="space-y-2">
            {results.map((doc) =>
              doc ? (
                <li key={doc.slug}>
                  <Link className="font-semibold hover:text-primary" href={`/docs/${doc.slug}`}>
                    {doc.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{doc.description}</p>
                </li>
              ) : null,
            )}
          </ul>
        </div>
      )}
    </div>
  );
}