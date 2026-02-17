import { Children, useEffect, useMemo, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cn, toPx } from './utils';

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | string | number;
type Drawerside = 'left' | 'right';
type ToolbarAlign = 'left' | 'right' | 'space-between';

export interface PFBoxProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
}

export function PFBox({ as, className, ...rest }: PFBoxProps) {
  const Component = (as ?? 'div') as ElementType;
  return <Component className={cn('pf-box', className)} {...rest} />;
}

export interface PFContainerProps extends HTMLAttributes<HTMLDivElement> {
  maxWidth?: MaxWidth;
  fluid?: boolean;
}

const maxWidthMap: Record<string, string> = {
  sm: '40rem',
  md: '52rem',
  lg: '64rem',
  xl: '76rem',
  '2xl': '90rem',
};

export function PFContainer({
  className,
  maxWidth = 'lg',
  fluid = false,
  style,
  ...rest
}: PFContainerProps) {
  const resolvedWidth =
    typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidthMap[maxWidth] ?? maxWidth;
  const mergedStyle: CSSProperties = {
    ...style,
    maxWidth: fluid ? 'none' : resolvedWidth,
  };
  return <div className={cn('pf-container', fluid && 'pf-container--fluid', className)} style={mergedStyle} {...rest} />;
}

export interface PFStackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column';
  gap?: number | string;
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
  wrap?: CSSProperties['flexWrap'];
}

export function PFStack({
  className,
  direction = 'column',
  gap = 'var(--pf-space-3)',
  align,
  justify,
  wrap,
  style,
  ...rest
}: PFStackProps) {
  const mergedStyle: CSSProperties = {
    ...style,
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap,
  };
  (mergedStyle as Record<string, string | undefined>)['--pf-stack-gap'] =
    typeof gap === 'number' ? `${gap}px` : gap;

  return (
    <div className={cn('pf-stack', direction === 'row' && 'pf-stack--row', className)} style={mergedStyle} {...rest} />
  );
}

export interface PFGridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: number;
  minItemWidth?: string;
  gap?: number | string;
}

export function PFGrid({
  className,
  columns = 12,
  minItemWidth,
  gap = 'var(--pf-space-4)',
  style,
  ...rest
}: PFGridProps) {
  const mergedStyle: CSSProperties = { ...style };
  (mergedStyle as Record<string, string>)['--pf-grid-columns'] = String(columns);
  (mergedStyle as Record<string, string>)['--pf-grid-gap'] =
    typeof gap === 'number' ? `${gap}px` : gap;
  (mergedStyle as Record<string, string>)['--pf-grid-min-item'] = minItemWidth ?? '0';
  return <div className={cn('pf-grid', className)} style={mergedStyle} {...rest} />;
}

export interface PFAppBarProps extends HTMLAttributes<HTMLElement> {
  position?: 'static' | 'sticky';
}

export function PFAppBar({ className, position = 'sticky', ...rest }: PFAppBarProps) {
  return <header className={cn('pf-app-bar', `pf-app-bar--${position}`, className)} {...rest} />;
}

export interface PFToolbarProps extends HTMLAttributes<HTMLDivElement> {
  align?: ToolbarAlign;
  wrap?: boolean;
  density?: 'comfortable' | 'compact';
}

export function PFToolbar({
  className,
  align = 'left',
  wrap = false,
  density,
  ...rest
}: PFToolbarProps) {
  return (
    <div
      className={cn(
        'pf-toolbar',
        `pf-toolbar--${align}`,
        wrap && 'pf-toolbar--wrap',
        density ? `pf-toolbar--${density}` : undefined,
        className,
      )}
      {...rest}
    />
  );
}

export interface PFPageShellProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  sidebar?: ReactNode;
  content?: ReactNode;
  rightPanel?: ReactNode;
  sidebarWidth?: number | string;
  collapsedSidebarWidth?: number | string;
  hasRightPanel?: boolean;
  headerHeight?: number | string;
  stickyHeader?: boolean;
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
  mobileSidebarLabel?: string;
}

export function PFPageShell({
  className,
  header,
  sidebar,
  content,
  rightPanel,
  children,
  sidebarWidth = 280,
  collapsedSidebarWidth = 84,
  hasRightPanel = false,
  headerHeight = 64,
  stickyHeader = true,
  sidebarCollapsed = false,
  onSidebarCollapsedChange,
  mobileSidebarLabel = 'Open navigation',
  style,
  ...rest
}: PFPageShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const hasSidebar = Boolean(sidebar);
  const showRightPanel = Boolean(hasRightPanel || rightPanel);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileSidebarOpen]);

  const mergedStyle: CSSProperties = {
    ...style,
    '--pf-page-shell-sidebar-width': toPx(sidebarWidth),
    '--pf-page-shell-collapsed-sidebar-width': toPx(collapsedSidebarWidth),
    '--pf-page-shell-header-height': toPx(headerHeight),
  } as CSSProperties;

  return (
    <div
      className={cn(
        'pf-page-shell',
        stickyHeader && 'pf-page-shell--sticky-header',
        hasSidebar && 'pf-page-shell--with-sidebar',
        showRightPanel && 'pf-page-shell--with-right-panel',
        sidebarCollapsed && 'pf-page-shell--sidebar-collapsed',
        className,
      )}
      style={mergedStyle}
      {...rest}
    >
      <header className="pf-page-shell__header">
        <div className="pf-page-shell__header-inner">
          {hasSidebar ? (
            <button
              type="button"
              className="pf-page-shell__mobile-toggle"
              aria-label={mobileSidebarLabel}
              onClick={() => setMobileSidebarOpen(true)}
            >
              ::
            </button>
          ) : null}
          <div className="pf-page-shell__header-content">{header}</div>
          {hasSidebar ? (
            <button
              type="button"
              className="pf-page-shell__collapse-toggle"
              onClick={() => onSidebarCollapsedChange?.(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? '>' : '<'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="pf-page-shell__body">
        {hasSidebar ? (
          <aside className="pf-page-shell__sidebar" aria-label="Sidebar navigation">
            {sidebar}
          </aside>
        ) : null}

        <main className="pf-page-shell__content">{content ?? children}</main>

        {showRightPanel ? (
          <aside className="pf-page-shell__right-panel" aria-label="Context panel">
            {rightPanel}
          </aside>
        ) : null}
      </div>

      {hasSidebar ? (
        <div
          className={cn('pf-page-shell__mobile-drawer', mobileSidebarOpen && 'is-open')}
          aria-hidden={!mobileSidebarOpen}
        >
          <button
            type="button"
            className="pf-page-shell__mobile-backdrop"
            aria-label="Close sidebar"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="pf-page-shell__mobile-panel">
            <div className="pf-page-shell__mobile-panel-header">
              <button
                type="button"
                className="pf-page-shell__mobile-close"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                x
              </button>
            </div>
            <div className="pf-page-shell__mobile-panel-body">{sidebar}</div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export interface PFSectionProps extends HTMLAttributes<HTMLElement> {
  title?: ReactNode;
  description?: ReactNode;
  titleKey?: string;
  descriptionKey?: string;
  actions?: ReactNode;
  intent?: 'neutral' | 'info' | 'warn';
}

export function PFSection({
  className,
  title,
  description,
  titleKey,
  descriptionKey,
  actions,
  intent = 'neutral',
  children,
  ...rest
}: PFSectionProps) {
  const resolvedTitle = title ?? titleKey;
  const resolvedDescription = description ?? descriptionKey;

  return (
    <section className={cn('pf-section', `pf-section--${intent}`, className)} {...rest}>
      {resolvedTitle || resolvedDescription || actions ? (
        <header className="pf-section__header">
          <div className="pf-section__copy">
            {resolvedTitle ? <h2 className="pf-section__title">{resolvedTitle}</h2> : null}
            {resolvedDescription ? <p className="pf-section__description">{resolvedDescription}</p> : null}
          </div>
          {actions ? <div className="pf-section__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="pf-section__body">{children}</div>
    </section>
  );
}

export interface PFSplitLayoutProps extends HTMLAttributes<HTMLDivElement> {
  left?: ReactNode;
  right?: ReactNode;
  leftWidthPercent?: number;
  gap?: number | string;
  stackOnMobile?: boolean;
}

export function PFSplitLayout({
  className,
  left,
  right,
  leftWidthPercent = 40,
  gap = 'var(--pf-space-4)',
  stackOnMobile = true,
  style,
  children,
  ...rest
}: PFSplitLayoutProps) {
  const childArray = Children.toArray(children);
  const resolvedLeft = left ?? childArray[0];
  const resolvedRight = right ?? childArray[1];
  const safeLeftPercent = Math.min(80, Math.max(20, Number(leftWidthPercent) || 40));

  const mergedStyle: CSSProperties = {
    ...style,
    '--pf-split-left-percent': `${safeLeftPercent}%`,
    '--pf-split-gap': typeof gap === 'number' ? `${gap}px` : gap,
  } as CSSProperties;

  return (
    <div
      className={cn('pf-split-layout', stackOnMobile && 'pf-split-layout--stack-mobile', className)}
      style={mergedStyle}
      {...rest}
    >
      <div className="pf-split-layout__pane pf-split-layout__pane--left">{resolvedLeft}</div>
      <div className="pf-split-layout__pane pf-split-layout__pane--right">{resolvedRight}</div>
    </div>
  );
}

type CardGridBreakpoints = {
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

export interface PFCardGridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: number | CardGridBreakpoints;
  gap?: number | string;
}

export function PFCardGrid({
  className,
  columns = { sm: 1, md: 2, lg: 3, xl: 4 },
  gap = 'var(--pf-space-4)',
  style,
  ...rest
}: PFCardGridProps) {
  const normalized = useMemo<CardGridBreakpoints>(() => {
    if (typeof columns === 'number') {
      const safe = Math.max(1, Math.trunc(columns));
      return { sm: 1, md: Math.min(safe, 2), lg: safe, xl: safe };
    }
    return {
      sm: Math.max(1, Math.trunc(columns.sm ?? 1)),
      md: Math.max(1, Math.trunc(columns.md ?? columns.sm ?? 2)),
      lg: Math.max(1, Math.trunc(columns.lg ?? columns.md ?? 3)),
      xl: Math.max(1, Math.trunc(columns.xl ?? columns.lg ?? 4)),
    };
  }, [columns]);

  const mergedStyle: CSSProperties = {
    ...style,
    '--pf-card-grid-cols-sm': String(normalized.sm ?? 1),
    '--pf-card-grid-cols-md': String(normalized.md ?? 2),
    '--pf-card-grid-cols-lg': String(normalized.lg ?? 3),
    '--pf-card-grid-cols-xl': String(normalized.xl ?? 4),
    '--pf-card-grid-gap': typeof gap === 'number' ? `${gap}px` : gap,
  } as CSSProperties;

  return <div className={cn('pf-card-grid', className)} style={mergedStyle} {...rest} />;
}

export interface PFEmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function PFEmptyState({
  className,
  icon,
  title,
  description,
  action,
  children,
  ...rest
}: PFEmptyStateProps) {
  return (
    <div className={cn('pf-empty-state', className)} role="status" {...rest}>
      {icon ? <div className="pf-empty-state__icon">{icon}</div> : null}
      {title ? <h3 className="pf-empty-state__title">{title}</h3> : null}
      {description ? <p className="pf-empty-state__description">{description}</p> : null}
      {children ? <div className="pf-empty-state__body">{children}</div> : null}
      {action ? <div className="pf-empty-state__action">{action}</div> : null}
    </div>
  );
}

export interface PFDrawerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean;
  onClose?: () => void;
  side?: Drawerside;
  title?: ReactNode;
  width?: string | number;
  disableBackdropClick?: boolean;
}

export function PFDrawer({
  className,
  open,
  onClose,
  side = 'left',
  title,
  width = '320px',
  style,
  children,
  disableBackdropClick = false,
  ...rest
}: PFDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  const mergedStyle: CSSProperties = { ...style };
  (mergedStyle as Record<string, string>)['--pf-drawer-width'] =
    typeof width === 'number' ? `${width}px` : width;

  return (
    <div className="pf-drawer-root" data-side={side}>
      <div
        className="pf-drawer-backdrop"
        onClick={() => {
          if (!disableBackdropClick) onClose?.();
        }}
        aria-hidden="true"
      />
      <aside
        className={cn('pf-drawer', `pf-drawer--${side}`, className)}
        role="dialog"
        aria-modal="true"
        style={mergedStyle}
        {...rest}
      >
        <header className="pf-drawer__header">
          <div className="pf-drawer__title">{title}</div>
          <button type="button" className="pf-drawer__close" onClick={() => onClose?.()} aria-label="Close drawer">
            x
          </button>
        </header>
        <div className="pf-drawer__content">{children}</div>
      </aside>
    </div>
  );
}

export interface PFAppShellProps extends HTMLAttributes<HTMLDivElement> {
  appBar?: ReactNode;
  drawer?: ReactNode;
  sidebar?: ReactNode;
  contentClassName?: string;
}

export function PFAppShell({
  className,
  appBar,
  drawer,
  sidebar,
  children,
  contentClassName,
  ...rest
}: PFAppShellProps) {
  return (
    <div className={cn('pf-app-shell', className)} {...rest}>
      {appBar ? <div className="pf-app-shell__app-bar">{appBar}</div> : null}
      {drawer}
      <div className="pf-app-shell__body">
        {sidebar ? <aside className="pf-app-shell__sidebar">{sidebar}</aside> : null}
        <main className={cn('pf-app-shell__content', contentClassName)}>{children}</main>
      </div>
    </div>
  );
}
