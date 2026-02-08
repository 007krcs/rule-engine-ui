'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  Boxes,
  LayoutDashboard,
  Menu,
  PackageOpen,
  Plug,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { apiPost, downloadFromApi } from '@/lib/demo/api-client';

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

function getPageTitle(pathname: string, tab?: string | null) {
  if (pathname === '/') return 'Overview';

  if (pathname.startsWith('/docs')) return 'Documentation';
  if (pathname.startsWith('/integrations')) return 'Integration Hub';
  if (pathname.startsWith('/builder')) return 'Builder';
  if (pathname.startsWith('/playground')) return 'Playground';

  if (pathname.startsWith('/console')) {
    if (tab === 'governance') return 'Governance';
    if (tab === 'observability') return 'Observability';
    if (tab === 'versions') return 'Versions';
    return 'Admin Console';
  }

  return pathname.slice(1);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newConfigOpen, setNewConfigOpen] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [newConfigDescription, setNewConfigDescription] = useState('');
  const [newConfigBusy, setNewConfigBusy] = useState(false);
  const { toast } = useToast();

  const tab = searchParams.get('tab');
  const pageTitle = useMemo(() => getPageTitle(pathname, tab), [pathname, tab]);

  const nav = (
    <div className="space-y-6">
      <nav className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Platform</p>
        <div className="mt-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
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
            const itemTab = item.href.split('tab=')[1] ?? null;
            const active = pathname === '/console' && itemTab && itemTab === tab;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
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
    </div>
  );

  const createConfig = async () => {
    const name = newConfigName.trim();
    if (!name) {
      toast({ variant: 'error', title: 'Config name is required' });
      return;
    }

    setNewConfigBusy(true);
    try {
      const result = await apiPost<{ ok: true; packageId: string; versionId: string }>('/api/config-packages', {
        name,
        description: newConfigDescription.trim() || undefined,
      });
      toast({ variant: 'success', title: 'Created draft config', description: result.versionId });
      setNewConfigOpen(false);
      setNewConfigName('');
      setNewConfigDescription('');
      router.push(`/builder?versionId=${encodeURIComponent(result.versionId)}`);
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to create config',
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setNewConfigBusy(false);
    }
  };

  const exportGitOps = async () => {
    try {
      await downloadFromApi('/api/gitops/export', 'ruleflow-gitops.json');
      toast({ variant: 'success', title: 'Exported GitOps bundle' });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Export failed',
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="z-40 flex h-16 shrink-0 items-center border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                RF
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">RuleFlow Platform</p>
                <p className="text-xs text-muted-foreground">Enterprise Configuration Runtime</p>
              </div>
            </Link>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Button variant="outline" size="sm" onClick={exportGitOps}>
              Export GitOps
            </Button>
            <Button size="sm" onClick={() => setNewConfigOpen(true)}>
              New Config
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/40"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[320px] max-w-[85vw] flex-col border-r border-border bg-background p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Navigation</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 overflow-y-auto pr-1 scrollbar-thin">{nav}</div>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 overflow-hidden px-4 py-6 sm:px-6">
        <aside className="hidden w-[260px] shrink-0 overflow-y-auto pr-1 scrollbar-thin lg:block">{nav}</aside>

        <main className="min-w-0 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-6 pb-10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Breadcrumbs />
                <h1 className="truncate text-2xl font-semibold">{pageTitle}</h1>
              </div>
              <div className="flex items-center gap-2 md:hidden">
                <ThemeToggle />
                <Button size="sm" onClick={() => setNewConfigOpen(true)}>
                  New
                </Button>
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>

      <Modal
        open={newConfigOpen}
        title="New Config Package"
        description="Create a new DRAFT package and start editing its UI schema."
        onClose={() => (newConfigBusy ? null : setNewConfigOpen(false))}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setNewConfigOpen(false)} disabled={newConfigBusy}>
              Cancel
            </Button>
            <Button type="button" onClick={createConfig} disabled={newConfigBusy || newConfigName.trim().length === 0}>
              {newConfigBusy ? 'Creating…' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Name</label>
            <Input value={newConfigName} onChange={(e) => setNewConfigName(e.target.value)} placeholder="Orders Bundle" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Description</label>
            <Textarea
              value={newConfigDescription}
              onChange={(e) => setNewConfigDescription(e.target.value)}
              placeholder="What does this bundle power?"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This local demo stores config state in memory with JSON persistence under <code>.ruleflow-demo-data</code>.
          </p>
        </div>
      </Modal>
    </div>
  );
}
