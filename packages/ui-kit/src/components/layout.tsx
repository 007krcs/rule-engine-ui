import { useEffect, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './utils';

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | string | number;
type Drawerside = 'left' | 'right';

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

export type PFToolbarProps = HTMLAttributes<HTMLDivElement>;

export function PFToolbar({ className, ...rest }: PFToolbarProps) {
  return <div className={cn('pf-toolbar', className)} {...rest} />;
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
