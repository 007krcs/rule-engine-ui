import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ComponentSystemProvider } from '@platform/component-system';
import styles from './layout.module.css';

export const metadata = {
  title: 'Ruleflow Builder',
  description: 'Builder console for composing UI rules and runtime flows.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ComponentSystemProvider>
          <div className={styles.appShell}>
            <header className={styles.topNav}>
              <div className={styles.brand}>
                <span className={styles.brandTitle}>Ruleflow Builder</span>
                <span className={styles.brandSubtitle}>Component Studio &amp; Flow Composer</span>
              </div>
              <nav className={styles.navLinks}>
                <Link className={styles.navLink} href="/">
                  Builder
                </Link>
                <Link className={styles.navLink} href="/studio">
                  Component Studio
                </Link>
              </nav>
            </header>
            <main className={styles.main}>{children}</main>
          </div>
        </ComponentSystemProvider>
      </body>
    </html>
  );
}
