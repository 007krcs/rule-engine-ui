'use client';

import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BuilderWorkspaceLayout.module.css';

interface BuilderWorkspaceLayoutProps {
  children: ReactNode;
}

type NavItem = { label: string; href: string; icon: string };

const navItems: NavItem[] = [
  { label: 'Screens', href: '/builder/screens', icon: '[]' },
  { label: 'Flow', href: '/builder/flow', icon: '->' },
  { label: 'Rules', href: '/builder/rules', icon: 'RL' },
  { label: 'Docs', href: '/builder/docs', icon: 'DOC' },
  { label: 'Repo', href: '/builder/repo', icon: 'GIT' },
  { label: 'JSON', href: '/builder/json', icon: '{}' },
];

export function BuilderWorkspaceLayout({ children }: BuilderWorkspaceLayoutProps) {
  const pathname = usePathname();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') return;
    const mq = window.matchMedia('(max-width: 900px)');
    const handleChange = () => setInspectorOpen(!mq.matches);
    handleChange();
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1100px)');
    const handleChange = () => setRailCollapsed(mq.matches);
    handleChange();
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const activeNav = useMemo(
    () => navItems.find((item) => pathname?.startsWith(item.href)),
    [pathname],
  );

  const toggleInspector = () => setInspectorOpen((open) => !open);

  return (
    <div
      className={`${styles.workspaceShell} ${railCollapsed ? styles.railCollapsed : ''} ${
        inspectorOpen ? '' : styles.inspectorCollapsed
      }`.trim()}
      data-testid="builder-shell"
    >
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>R</span>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Ruleflow Builder</span>
            <span className={styles.brandSubtitle}>Multi-workspace console</span>
          </div>
        </div>

        <div className={styles.breadcrumbs} aria-label="Current workspace">
          <span className={styles.crumbLabel}>Workspace</span>
          <span className={styles.crumbValue}>{activeNav?.label ?? 'Overview'}</span>
        </div>

        <div className={styles.topActions}>
          <div className={styles.actionGroup}>
            <button type="button" className={styles.ghostButton} aria-label="Save project">
              Save
            </button>
            <button type="button" className={styles.ghostButton} aria-label="Validate configuration">
              Validate
            </button>
            <button type="button" className={styles.ghostButton} aria-label="Preview">
              Preview
            </button>
            <button type="button" className={styles.primaryButton} aria-label="Export bundle">
              Export
            </button>
          </div>
          <div className={styles.actionGroup}>
            <Link className={styles.ghostButton} href="/builder/legacy">
              Legacy Builder
            </Link>
            <button
              type="button"
              className={styles.ghostButton}
              aria-pressed={inspectorOpen}
              aria-controls="inspector-panel"
              onClick={toggleInspector}
            >
              {inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}
            </button>
          </div>
        </div>
      </header>

      <nav
        className={`${styles.navRail} ${railCollapsed ? styles.railCollapsed : ''}`.trim()}
        aria-label="Builder workspaces"
      >
        <p className={styles.navHeading}>Workspaces</p>
        <ul className={styles.navList}>
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`.trim()}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span aria-hidden className={styles.navIcon}>
                    {item.icon}
                  </span>
                  <span className={styles.navLabel}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className={styles.main}>
        <div className={styles.contentCard}>{children}</div>
      </main>

      <aside
        id="inspector-panel"
        className={`${styles.inspector} ${!inspectorOpen ? styles.drawerHidden : ''}`.trim()}
        aria-label="Inspector panel"
      >
        <div className={styles.inspectorHeader}>
          <div>
            <p className={styles.navHeading} style={{ marginBottom: 4 }}>
              Inspector
            </p>
            <strong>Contextual properties</strong>
          </div>
          <button type="button" className={styles.ghostButton} onClick={toggleInspector}>
            Close
          </button>
        </div>
        <p className={styles.inspectorCopy}>
          Select an element in the workspace to edit its properties. This panel will host contextual controls.
        </p>
      </aside>
    </div>
  );
}
