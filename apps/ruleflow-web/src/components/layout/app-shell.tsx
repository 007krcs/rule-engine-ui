'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BookOpen,
  Boxes,
  LayoutDashboard,
  PackageOpen,
  Plug,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/console', label: 'Admin Console', icon: LayoutDashboard },
  { href: '/builder', label: 'Builder', icon: Boxes },
  { href: '/playground', label: 'Playground', icon: Sparkles },
  { href: '/docs', label: 'Documentation', icon: BookOpen },
  { href: '/integrations', label: 'Integration Hub', icon: Plug },
];

const systemItems = [
  { href: '/console?tab=governance', label: 'Governance', icon: ShieldCheck },
  { href: '/console?tab=observability', label: 'Observability', icon: Activity },
  { href: '/console?tab=versions', label: 'Versions', icon: PackageOpen },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              RF
            </div>
            <div>
              <p className="text-sm font-semibold">RuleFlow Platform</p>
              <p className="text-xs text-muted-foreground">Enterprise Configuration Runtime</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Button variant="outline" size="sm">
              Export GitOps
            </Button>
            <Button size="sm">New Config</Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-6">
          <nav className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Platform
            </p>
            <div className="mt-3 space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <nav className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">System</p>
            <div className="mt-3 space-y-1">
              {systemItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-transparent to-accent/10 p-4">
            <p className="text-sm font-semibold">RBAC: Author · Approver · Publisher · Viewer</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Tenant isolation active. Signed releases required for publishing.
            </p>
          </div>
        </aside>

        <main className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Breadcrumbs />
              <h1 className="text-2xl font-semibold capitalize">{pathname === '/' ? 'Overview' : pathname.slice(1)}</h1>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />
              <Button size="sm">New</Button>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}