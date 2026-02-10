'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Activity, BookOpen, Boxes, HeartPulse, LayoutDashboard, ListTodo, Menu, PackageOpen, Plug, ShieldCheck, Sparkles, X } from 'lucide-react';
import styles from './app-shell.module.css';
import { cn } from '@/lib/utils';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { apiPost, downloadFromApi } from '@/lib/demo/api-client';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';

const navItems = [
  { href: '/console', label: 'Admin Console', icon: LayoutDashboard },
  { href: '/builder', label: 'Builder', icon: Boxes },
  { href: '/playground', label: 'Playground', icon: Sparkles },
  { href: '/samples', label: 'Samples', icon: PackageOpen },
  { href: '/docs', label: 'Documentation', icon: BookOpen },
  { href: '/integrations', label: 'Integration Hub', icon: Plug },
];

const systemItems = [
  { href: '/console?tab=governance', label: 'Governance', icon: ShieldCheck },
  { href: '/console?tab=observability', label: 'Observability', icon: Activity },
  { href: '/console?tab=versions', label: 'Versions', icon: PackageOpen },
  { href: '/system/health', label: 'Health', icon: HeartPulse },
  { href: '/system/roadmap', label: 'Roadmap', icon: ListTodo },
];

function getPageTitle(pathname: string, tab?: string | null) {
  if (pathname === '/') return 'Overview';

  if (pathname.startsWith('/docs')) return 'Documentation';
  if (pathname.startsWith('/samples')) return 'Samples';
  if (pathname.startsWith('/integrations')) return 'Integration Hub';
  if (pathname.startsWith('/builder')) return 'Builder';
  if (pathname.startsWith('/playground')) return 'Playground';

  if (pathname.startsWith('/console')) {
    if (tab === 'governance') return 'Governance';
    if (tab === 'observability') return 'Observability';
    if (tab === 'versions') return 'Versions';
    return 'Admin Console';
  }

  if (pathname.startsWith('/system/health')) return 'Health';
  if (pathname.startsWith('/system/roadmap')) return 'Roadmap';

  return pathname.slice(1);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = useOnboarding();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newConfigOpen, setNewConfigOpen] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [newConfigDescription, setNewConfigDescription] = useState('');
  const [newConfigBusy, setNewConfigBusy] = useState(false);
  const { toast } = useToast();

  const tab = searchParams.get('tab');
  const pageTitle = useMemo(() => getPageTitle(pathname, tab), [pathname, tab]);

  const nav = (
    <div className={styles.navStack}>
      <nav className={styles.navCard}>
        <p className={styles.navTitle}>Platform</p>
        <div className={styles.navList}>
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(styles.navItem, active ? styles.navItemActive : undefined)}
              >
                <Icon className={styles.navIcon} aria-hidden="true" focusable="false" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <nav className={styles.navCard}>
        <p className={styles.navTitle}>System</p>
        <div className={styles.navList}>
          {systemItems.map((item) => {
            const Icon = item.icon;
            const isConsoleTab = item.href.startsWith('/console?tab=');
            const itemTab = isConsoleTab ? (item.href.split('tab=')[1] ?? null) : null;
            const active = isConsoleTab
              ? pathname === '/console' && itemTab && itemTab === tab
              : pathname === item.href || pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(styles.navItem, active ? styles.navItemActive : undefined)}
              >
                <Icon className={styles.navIcon} aria-hidden="true" focusable="false" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={styles.rbacCard}>
        <p className={styles.rbacTitle}>RBAC: Author / Approver / Publisher / Viewer</p>
        <p className={styles.rbacText}>Tenant isolation active. Signed releases required for publishing.</p>
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
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={styles.menuButton}
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu width={16} height={16} aria-hidden="true" focusable="false" />
            </Button>

            <Link href="/" className={styles.logoLink}>
              <div className={styles.logoMark} aria-hidden="true">
                RF
              </div>
              <div className={styles.logoText}>
                <p className={styles.logoTitle}>RuleFlow Platform</p>
                <p className={styles.logoSubtitle}>Enterprise Configuration Runtime</p>
              </div>
            </Link>
          </div>

          <div className={styles.headerActions}>
            <Button variant="outline" size="sm" onClick={exportGitOps}>
              Export GitOps
            </Button>
            <Button variant="outline" size="sm" onClick={onboarding.open}>
              Get Started
            </Button>
            <Button size="sm" onClick={() => setNewConfigOpen(true)}>
              New Config
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {mobileNavOpen && (
        <div className={styles.drawerOverlay} role="dialog" aria-modal="true">
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className={cn(styles.drawer, 'rfScrollbar')}>
            <div className={styles.drawerHeader}>
              <p className={styles.drawerTitle}>Navigation</p>
              <Button type="button" size="sm" variant="ghost" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>
                <X width={16} height={16} aria-hidden="true" focusable="false" />
              </Button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <div className={styles.body}>
        <aside className={cn(styles.sidebar, 'rfScrollbar')}>{nav}</aside>

        <main className={cn(styles.main, 'rfScrollbar')}>
          <div className={styles.mainInner}>
            <div className={styles.pageHeader}>
              <div className={styles.pageHeaderLeft}>
                <Breadcrumbs />
                <h1 className={styles.pageTitle}>{pageTitle}</h1>
              </div>
          <div className={styles.mobileActions}>
            <ThemeToggle />
            <Button size="sm" variant="outline" onClick={onboarding.open}>
              Help
            </Button>
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
          <div className={styles.modalFooter}>
            <Button type="button" variant="outline" onClick={() => setNewConfigOpen(false)} disabled={newConfigBusy}>
              Cancel
            </Button>
            <Button type="button" onClick={createConfig} disabled={newConfigBusy || newConfigName.trim().length === 0}>
              {newConfigBusy ? 'Creating...' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className={styles.modalBody}>
          <div>
            <label className={styles.fieldLabel}>Name</label>
            <Input value={newConfigName} onChange={(e) => setNewConfigName(e.target.value)} placeholder="Orders Bundle" />
          </div>
          <div>
            <label className={styles.fieldLabel}>Description</label>
            <Textarea value={newConfigDescription} onChange={(e) => setNewConfigDescription(e.target.value)} placeholder="What does this bundle power?" />
          </div>
          <p className={styles.helperText}>
            This local demo stores config state in memory with JSON persistence under <span className={styles.codeInline}>.ruleflow-demo-data</span>.
          </p>
        </div>
      </Modal>

      <OnboardingWizard />
    </div>
  );
}
