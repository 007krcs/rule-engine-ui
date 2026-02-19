import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Ruleflow Builder',
  description: 'Builder console for composing UI rules and runtime flows.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
