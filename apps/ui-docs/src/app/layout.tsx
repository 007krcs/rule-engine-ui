import '@platform/ui-kit/styles.css';
import './globals.css';
import Link from 'next/link';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { categoryLabels, categoryOrder } from '@/lib/catalog';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--docs-font-display',
  display: 'swap',
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--docs-font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata = {
  title: 'Platform UI Kit Catalog',
  description: 'Enterprise UI component catalog and theming docs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" data-density="comfortable">
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
        <div className="docs-root pf-root">
          <header className="docs-header">
            <div className="docs-header__row">
              <Link className="docs-brand" href="/">
                Platform UI Kit
              </Link>
              <nav className="docs-header__links" aria-label="Primary navigation">
                <Link href="/theming">Theme Customization</Link>
              </nav>
            </div>
            <nav className="docs-categories" aria-label="Component categories">
              {categoryOrder.map((category) => (
                <Link key={category} href={`/category/${category}`}>
                  {categoryLabels[category]}
                </Link>
              ))}
            </nav>
          </header>
          <main className="docs-main">
            <div className="docs-container">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
