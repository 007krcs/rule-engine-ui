import type { ReactNode } from 'react';
import { BuilderProvider } from '@/context/BuilderContext';

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return <BuilderProvider>{children}</BuilderProvider>;
}
