import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Ruleflow Playground',
  description: 'Run flow transitions and inspect runtime plans with sample context.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
