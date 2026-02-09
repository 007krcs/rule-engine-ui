'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './breadcrumbs.module.css';

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol className={styles.list}>
        <li className={styles.item}>
          <Link className={styles.link} href="/">
            Home
          </Link>
        </li>
        {segments.map((segment, index) => {
          const href = '/' + segments.slice(0, index + 1).join('/');
          const label = segment.replace(/-/g, ' ');
          return (
            <li key={href} className={styles.item}>
              <span aria-hidden="true">/</span>
              <Link className={`${styles.link} ${styles.segment}`} href={href}>
                {label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

