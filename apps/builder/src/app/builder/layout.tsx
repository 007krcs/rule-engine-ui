import type { ReactNode } from 'react';
import { BuilderWorkspaceLayout } from '../../components/BuilderWorkspaceLayout';

export const metadata = {
  title: 'Builder Workspaces',
  description: 'Multi-workspace console for Ruleflow.',
};

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return <BuilderWorkspaceLayout>{children}</BuilderWorkspaceLayout>;
}
