'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  Activity,
  BookOpen,
  Boxes,
  HeartPulse,
  LayoutDashboard,
  LayoutTemplate,
  ListTodo,
  Menu,
  PackageOpen,
  Plug,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  PFButton,
  PFDialog,
  PFIconButton,
  PFTextArea,
  PFTextField,
} from '@platform/ui-kit';
import styles from './app-shell.module.scss';
import { cn } from '@/lib/utils';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { DensityToggle } from '@/components/layout/density-toggle';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useToast } from '@/components/ui/toast';
import { apiPost, downloadFromApi } from '@/lib/demo/api-client';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';
import { useRuntimeAdapters } from '@/lib/use-runtime-adapters';

const navItems = [
  { href: '/console', label: 'Admin Console', icon: LayoutDashboard },
  { href: '/branding', label: 'Branding', icon: Sparkles },
  { href: '/builder', label: 'Builder', icon: Boxes },
  { href: '/playground', label: 'Playground', icon: Sparkles },
  { href: '/samples', label: 'Samples', icon: PackageOpen },
  { href: '/component-registry', label: 'Component Registry', icon: Plug },
  { href: '/docs', label: 'Documentation', icon: BookOpen },
  { href: '/integrations', label: 'Integration Hub', icon: Plug },
];

const systemItems = [
  { href: '/console?tab=governance', label: 'Governance', icon: ShieldCheck },
  { href: '/console?tab=observability', label: 'Observability', icon: Activity },
  { href: '/console?tab=versions', label: 'Versions', icon: PackageOpen },
  { href: '/system/templates', label: 'Template Library', icon: LayoutTemplate },
  { href: '/system/theme-studio', label: 'Theme Studio', icon: Sparkles },
  { href: '/system/adapters-vue', label: 'Vue Adapter Demo', icon: Plug },
  { href: '/system/adapters-angular', label: 'Angular Adapter Demo', icon: Plug },
  { href: '/system/ui-kit', label: 'UI Kit', icon: Sparkles },
  { href: '/system/translations', label: 'Translations', icon: BookOpen },
  { href: '/system/layout-check', label: 'Layout Check', icon: Boxes },
  { href: '/system/health', label: 'Health', icon: HeartPulse },
  { href: '/system/roadmap', label: 'Roadmap', icon: ListTodo },
];

function helpHrefForPathname(pathname: string): string {
  if (pathname.startsWith('/builder/flow')) return '/docs/tutorial-flow-editor';
  if (pathname.startsWith('/builder/api-mappings')) return '/docs/schemas';
  if (pathname.startsWith('/builder/rules')) return '/docs/tutorial-rules';
  if (pathname.startsWith('/builder')) return '/docs/tutorial-builder';
  if (pathname.startsWith('/playground')) return '/docs/tutorial-playground';
  if (pathname.startsWith('/console')) return '/docs/tutorial-console';
  if (pathname.startsWith('/component-registry')) return '/docs/tutorial-component-registry';
  if (pathname.startsWith('/integrations')) return '/docs/tutorial-integrations';
  if (pathname.startsWith('/system/templates')) return '/docs/tutorial-template-library';
  if (pathname.startsWith('/system/adapters-vue')) return '/docs/tutorial-integrations';
  if (pathname.startsWith('/system/adapters-angular')) return '/docs/tutorial-integrations';
  if (pathname.startsWith('/system/theme-studio')) return '/docs';
  if (pathname.startsWith('/system/ui-kit')) return '/docs';
  if (pathname.startsWith('/samples')) return '/docs/quickstart';
  if (pathname.startsWith('/docs')) return '/docs';
  return '/docs/quickstart';
}

function getPageTitle(pathname: string, tab?: string | null) {
  if (pathname === '/') return 'Overview';

  if (pathname.startsWith('/docs')) return 'Documentation';
  if (pathname.startsWith('/samples')) return 'Samples';
  if (pathname.startsWith('/component-registry')) return 'Component Registry';
  if (pathname.startsWith('/integrations')) return 'Integration Hub';
  if (pathname.startsWith('/builder/flow')) return 'Flow Builder';
  if (pathname.startsWith('/builder/api-mappings')) return 'API Mapping Builder';
  if (pathname.startsWith('/builder')) return 'Builder';
  if (pathname.startsWith('/playground')) return 'Playground';

  if (pathname.startsWith('/console')) {
    if (tab === 'governance') return 'Governance';
    if (tab === 'observability') return 'Observability';
    if (tab === 'versions') return 'Versions';
    return 'Admin Console';
  }

  if (pathname.startsWith('/system/health')) return 'Health';
  if (pathname.startsWith('/system/templates')) return 'Template Library';
  if (pathname.startsWith('/system/theme-studio')) return 'Theme Studio';
  if (pathname.startsWith('/system/adapters-vue')) return 'Vue Adapter Demo';
  if (pathname.startsWith('/system/adapters-angular')) return 'Angular Adapter Demo';
  if (pathname.startsWith('/system/ui-kit')) return 'UI Kit';
  if (pathname.startsWith('/system/translations')) return 'Translations';
  if (pathname.startsWith('/system/layout-check')) return 'Layout Check';
  if (pathname.startsWith('/system/roadmap')) return 'Roadmap';

  return pathname.slice(1);
}

function getScreenPreset(pathname: string): 'console' | 'builder' | 'playground' | 'docs' | 'system' | 'default' {
  if (pathname.startsWith('/console') || pathname.startsWith('/branding')) return 'console';
  if (pathname.startsWith('/builder') || pathname.startsWith('/component-registry')) return 'builder';
  if (pathname.startsWith('/playground') || pathname.startsWith('/samples')) return 'playground';
  if (pathname.startsWith('/docs') || pathname.startsWith('/integrations')) return 'docs';
  if (pathname.startsWith('/system')) return 'system';
  return 'default';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useRuntimeAdapters({ env: 'prod' });
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = useOnboarding();
  const [clientReady, setClientReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newConfigOpen, setNewConfigOpen] = useState(false);
  const [newConfigTenantId, setNewConfigTenantId] = useState('tenant-1');
  const [newConfigId, setNewConfigId] = useState('');
  const [newConfigName, setNewConfigName] = useState('');
  const [newConfigDescription, setNewConfigDescription] = useState('');
  const [newConfigBusy, setNewConfigBusy] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const { toast } = useToast();

  const tab = searchParams.get('tab');
  const pageTitle = useMemo(() => getPageTitle(pathname, tab), [pathname, tab]);
  const helpHref = useMemo(() => helpHrefForPathname(pathname), [pathname]);
  const screenPreset = useMemo(() => getScreenPreset(pathname), [pathname]);
  const activeVersionId = onboarding.state.activeVersionId;

  useEffect(() => {
    setClientReady(true);
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        setCommandQuery('');
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const nav = (
    <div className={styles.navStack}>
      <nav className={cn(styles.navCard, 'pf-surface-panel')}>
        <p className={styles.navTitle}>Platform</p>
        <div className={styles.navList}>
          <button
            type="button"
            onClick={() => {
              onboarding.open();
              setMobileNavOpen(false);
            }}
            className={cn(styles.navItem, styles.navButton, onboarding.state.open ? styles.navItemActive : undefined)}
          >
            <Sparkles className={styles.navIcon} aria-hidden="true" focusable="false" />
            Getting Started
          </button>
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

      <nav className={cn(styles.navCard, 'pf-surface-panel')}>
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

      <div className={cn(styles.rbacCard, 'pf-surface-panel')}>
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
        tenantId: newConfigTenantId.trim() || undefined,
        configId: newConfigId.trim() || undefined,
      });
      toast({ variant: 'success', title: 'Created draft config', description: result.versionId });
      setNewConfigOpen(false);
      setNewConfigTenantId('tenant-1');
      setNewConfigId('');
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
      onboarding.completeStep('exportGitOps');
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Export failed',
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const commandActions = useMemo(() => {
    const withActive = (href: string) => (activeVersionId ? `${href}${href.includes('?') ? '&' : '?'}versionId=${encodeURIComponent(activeVersionId)}` : href);

    return [
      { id: 'getting-started', label: 'Getting Started Wizard', onRun: () => onboarding.open() },
      { id: 'new-config', label: 'New Config', onRun: () => setNewConfigOpen(true) },
      { id: 'open-builder', label: 'Open Builder', onRun: () => router.push(withActive('/builder')) },
      { id: 'open-flow-builder', label: 'Open Flow Builder', onRun: () => router.push(withActive('/builder/flow')) },
      { id: 'open-api-mappings-builder', label: 'Open API Mapping Builder', onRun: () => router.push(withActive('/builder/api-mappings')) },
      { id: 'open-rules', label: 'Open Rules Builder', onRun: () => router.push(withActive('/builder/rules')) },
      { id: 'open-playground', label: 'Open Playground', onRun: () => router.push(withActive('/playground')) },
      { id: 'open-console', label: 'Open Console', onRun: () => router.push('/console') },
      { id: 'open-samples', label: 'Open Samples Gallery', onRun: () => router.push('/samples') },
      { id: 'open-component-registry', label: 'Open Component Registry', onRun: () => router.push('/component-registry') },
      { id: 'open-templates', label: 'Open Template Library', onRun: () => router.push('/system/templates') },
      { id: 'open-docs', label: 'Open Docs', onRun: () => router.push('/docs') },
      { id: 'help', label: 'Help (this page)', onRun: () => router.push(helpHref) },
      { id: 'export-gitops', label: 'Export GitOps Bundle', onRun: () => void exportGitOps() },
    ];
  }, [activeVersionId, exportGitOps, helpHref, onboarding, router]);

  const filteredActions = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return commandActions;
    return commandActions.filter((action) => action.label.toLowerCase().includes(q));
  }, [commandActions, commandQuery]);

  return (
    <div className={cn(styles.shell, 'rf-app-shell')} data-pf-screen={screenPreset}>
        {clientReady ? <span data-testid="client-ready" className={styles.clientReady} aria-hidden="true" /> : null}
        <header className={cn(styles.header, 'pf-surface-panel')}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <PFIconButton
              type="button"
              size="sm"
              variant="ghost"
              className={styles.menuButton}
              label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu width={16} height={16} aria-hidden="true" focusable="false" />
            </PFIconButton>

            <Link href="/" className={styles.logoLink}>
              <div className={styles.logoMark} aria-hidden="true">
                ECR
              </div>
              <div className={styles.logoText}>
                <p className={styles.logoTitle}>Enterprise Configuration Runtime</p>
                <p className={styles.logoSubtitle}>ECR</p>
              </div>
            </Link>
          </div>

          <div className={styles.headerActions}>
            <PFButton variant="outline" intent="neutral" size="sm" onClick={exportGitOps}>
              Export GitOps
            </PFButton>
            <Link className={cn('pf-button', 'pf-size-sm', 'pf-button--outline', 'pf-button--neutral')} href={helpHref}>
              Help
            </Link>
            <PFButton variant="outline" intent="neutral" size="sm" onClick={onboarding.open}>
              Get Started
            </PFButton>
            <PFButton size="sm" onClick={() => setNewConfigOpen(true)}>
              New Config
            </PFButton>
            <DensityToggle />
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
          <div className={cn(styles.drawer, 'rfScrollbar', 'pf-surface-panel')}>
            <div className={styles.drawerHeader}>
              <p className={styles.drawerTitle}>Navigation</p>
              <PFIconButton
                type="button"
                size="sm"
                variant="ghost"
                label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
              >
                <X width={16} height={16} aria-hidden="true" focusable="false" />
              </PFIconButton>
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
                <DensityToggle />
                <Link className={cn('pf-button', 'pf-size-sm', 'pf-button--outline', 'pf-button--neutral')} href={helpHref}>
                  Help
                </Link>
                <PFButton size="sm" onClick={() => setNewConfigOpen(true)}>
                  New
                </PFButton>
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>

        <PFDialog
        open={newConfigOpen}
        title="New Config Package"
        description="Create a new DRAFT package and start editing its UI schema."
        onClose={() => (newConfigBusy ? null : setNewConfigOpen(false))}
        actions={(
          <div className={styles.modalFooter}>
            <PFButton type="button" variant="outline" intent="neutral" onClick={() => setNewConfigOpen(false)} disabled={newConfigBusy}>
              Cancel
            </PFButton>
            <PFButton type="button" onClick={createConfig} disabled={newConfigBusy || newConfigName.trim().length === 0}>
              {newConfigBusy ? 'Creating...' : 'Create'}
            </PFButton>
          </div>
        )}
      >
        <div className={styles.modalBody}>
          <div className={styles.modalGridTwo}>
            <PFTextField
              id="new-config-tenant-id"
              label="Tenant Id"
              value={newConfigTenantId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewConfigTenantId(e.target.value)}
              placeholder="tenant-1"
            />
            <PFTextField
              id="new-config-id"
              label="Config Id"
              value={newConfigId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewConfigId(e.target.value)}
              placeholder="checkout-flow"
            />
          </div>
          <PFTextField
            id="new-config-name"
            label="Name"
            value={newConfigName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNewConfigName(e.target.value)}
            placeholder="Orders Bundle"
            required
          />
          <div>
            <label htmlFor="new-config-description" className={styles.fieldLabel}>Description</label>
            <PFTextArea
              id="new-config-description"
              value={newConfigDescription}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewConfigDescription(e.target.value)}
              placeholder="What does this bundle power?"
            />
          </div>
          <p className={styles.helperText}>
            This local demo stores config state in memory with JSON persistence under <span className={styles.codeInline}>.ruleflow-demo-data</span>.
          </p>
        </div>
      </PFDialog>

        <OnboardingWizard />

        <PFDialog
        open={commandOpen}
        title="Command Palette"
        description="Type to filter. Shortcut: Ctrl+K"
        onClose={() => setCommandOpen(false)}
      >
        <div className={styles.commandBody}>
          <PFTextField
            id="command-search"
            label="Search actions"
            autoFocus
            placeholder="Search actions..."
            value={commandQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCommandQuery(e.target.value)}
          />
          <div className={styles.commandList} role="list">
            {filteredActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={styles.commandItem}
                onClick={() => {
                  setCommandOpen(false);
                  action.onRun();
                }}
              >
                {action.label}
              </button>
            ))}
            {filteredActions.length === 0 ? <p className={styles.commandEmpty}>No matches.</p> : null}
          </div>
        </div>
        </PFDialog>
      </div>
  );
}
