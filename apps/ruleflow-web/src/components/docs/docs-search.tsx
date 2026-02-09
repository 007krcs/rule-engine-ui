'use client';

import { useMemo, useState } from 'react';
import lunr from 'lunr';
import Link from 'next/link';
import { docs } from '@/lib/docs';
import { Input } from '@/components/ui/input';
import styles from './docs-search.module.css';

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
    <div className={styles.wrap}>
      <Input placeholder="Search docs" value={query} onChange={(event) => setQuery(event.target.value)} />
      {query && (
        <div className={styles.results}>
          {results.length === 0 && <p className={styles.empty}>No results.</p>}
          <ul className={styles.list}>
            {results.map((doc) =>
              doc ? (
                <li key={doc.slug}>
                  <Link className={styles.link} href={`/docs/${doc.slug}`}>
                    {doc.title}
                  </Link>
                  <p className={styles.desc}>{doc.description}</p>
                </li>
              ) : null,
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
