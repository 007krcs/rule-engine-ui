'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import styles from './BuilderShell.module.scss';

type MobilePanel = 'palette' | 'inspector';
type SplitterSide = 'left' | 'right';

export type BuilderShellProps = {
  className?: string;
  palette: ReactNode;
  canvasToolbar: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  storageKey?: string;
};

type ShellPrefs = {
  paletteWidth: number;
  inspectorWidth: number;
  hidePalette: boolean;
  hideInspector: boolean;
};

const MOBILE_BREAKPOINT = 1200;
const DEFAULT_PREFS: ShellPrefs = {
  paletteWidth: 320,
  inspectorWidth: 360,
  hidePalette: false,
  hideInspector: false,
};
const MIN_PALETTE = 240;
const MAX_PALETTE = 460;
const MIN_INSPECTOR = 280;
const MAX_INSPECTOR = 520;

function isNarrowViewport() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readPrefs(storageKey: string): ShellPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ShellPrefs>;
    return {
      paletteWidth: clamp(Number(parsed.paletteWidth) || DEFAULT_PREFS.paletteWidth, MIN_PALETTE, MAX_PALETTE),
      inspectorWidth: clamp(
        Number(parsed.inspectorWidth) || DEFAULT_PREFS.inspectorWidth,
        MIN_INSPECTOR,
        MAX_INSPECTOR,
      ),
      hidePalette: Boolean(parsed.hidePalette),
      hideInspector: Boolean(parsed.hideInspector),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function BuilderShell({
  className,
  palette,
  canvasToolbar,
  canvas,
  inspector,
  storageKey = 'ruleflow:builder:layout:v2',
}: BuilderShellProps) {
  const [isMobile, setIsMobile] = useState(isNarrowViewport);
  const [panelsOpen, setPanelsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<MobilePanel>('palette');
  const [prefs, setPrefs] = useState<ShellPrefs>(DEFAULT_PREFS);
  const dragRef = useRef<{ side: SplitterSide; startX: number; startValue: number } | null>(null);

  useEffect(() => {
    setPrefs(readPrefs(storageKey));
  }, [storageKey]);

  useEffect(() => {
    const onResize = () => {
      const next = isNarrowViewport();
      setIsMobile(next);
      if (!next) setPanelsOpen(false);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(prefs));
  }, [prefs, storageKey]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = event.clientX - drag.startX;
      if (drag.side === 'left') {
        setPrefs((current) => ({
          ...current,
          paletteWidth: clamp(drag.startValue + delta, MIN_PALETTE, MAX_PALETTE),
        }));
      } else {
        setPrefs((current) => ({
          ...current,
          inspectorWidth: clamp(drag.startValue - delta, MIN_INSPECTOR, MAX_INSPECTOR),
        }));
      }
    };
    const onMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const startResize = (side: SplitterSide, startX: number) => {
    dragRef.current = {
      side,
      startX,
      startValue: side === 'left' ? prefs.paletteWidth : prefs.inspectorWidth,
    };
  };

  const onSplitterKeyDown = (side: SplitterSide, event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 16 : -16;
    if (side === 'left') {
      setPrefs((current) => ({
        ...current,
        paletteWidth: clamp(current.paletteWidth + delta, MIN_PALETTE, MAX_PALETTE),
      }));
    } else {
      setPrefs((current) => ({
        ...current,
        inspectorWidth: clamp(current.inspectorWidth - delta, MIN_INSPECTOR, MAX_INSPECTOR),
      }));
    }
  };

  const resetLayout = () => {
    setPrefs(DEFAULT_PREFS);
  };

  const hideBoth = prefs.hidePalette && prefs.hideInspector;
  const showPalette = !prefs.hidePalette;
  const showInspector = !prefs.hideInspector;

  const desktopColumns = useMemo(() => {
    if (showPalette && showInspector) {
      return 'var(--builder-palette-width) 10px minmax(0, 1fr) 10px var(--builder-inspector-width)';
    }
    if (showPalette) {
      return 'var(--builder-palette-width) 10px minmax(0, 1fr)';
    }
    if (showInspector) {
      return 'minmax(0, 1fr) 10px var(--builder-inspector-width)';
    }
    return 'minmax(0, 1fr)';
  }, [showInspector, showPalette]);

  const shellStyle = useMemo(
    () =>
      ({
        '--builder-palette-width': `${prefs.paletteWidth}px`,
        '--builder-inspector-width': `${prefs.inspectorWidth}px`,
        gridTemplateColumns: desktopColumns,
      }) as CSSProperties,
    [desktopColumns, prefs.inspectorWidth, prefs.paletteWidth],
  );

  if (isMobile) {
    return (
      <section className={cn(styles.shell, styles.mobileShell, className)} data-testid="builder-shell">
        <section className={cn(styles.workspace, 'rf-builder-workspace')} data-testid="builder-canvas-workspace">
          <div className={styles.toolbar}>
            <div className={styles.mobileControls}>
              <button
                type="button"
                className={styles.mobilePanelsButton}
                onClick={() => setPanelsOpen((value) => !value)}
                data-testid="builder-panels-toggle"
                aria-expanded={panelsOpen}
                aria-controls="builder-mobile-panels"
              >
                Panels
              </button>
              {panelsOpen ? (
                <div className={styles.mobileTabs} role="tablist" aria-label="Builder panels">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activePanel === 'palette'}
                    className={cn(styles.mobileTab, activePanel === 'palette' ? styles.mobileTabActive : undefined)}
                    onClick={() => setActivePanel('palette')}
                  >
                    Palette
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activePanel === 'inspector'}
                    className={cn(styles.mobileTab, activePanel === 'inspector' ? styles.mobileTabActive : undefined)}
                    onClick={() => setActivePanel('inspector')}
                  >
                    Inspector
                  </button>
                </div>
              ) : null}
            </div>
            {canvasToolbar}
          </div>

          {panelsOpen ? (
            <div
              id="builder-mobile-panels"
              className={cn(styles.mobilePanel, 'pf-surface-panel')}
              data-testid={activePanel === 'palette' ? 'builder-palette-panel' : 'builder-inspector-panel'}
            >
              {activePanel === 'palette' ? palette : inspector}
            </div>
          ) : null}

          <div className={styles.viewport} data-testid="builder-canvas-viewport">
            {canvas}
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className={cn(styles.shell, className)} style={shellStyle} data-testid="builder-shell">
      {showPalette ? (
        <aside className={cn(styles.sidePane, 'pf-surface-panel')} data-testid="builder-palette-panel">
          {palette}
        </aside>
      ) : null}

      {showPalette ? (
        <div
          className={styles.splitter}
          data-testid="builder-splitter-left"
          role="separator"
          aria-label="Resize palette panel"
          aria-orientation="vertical"
          aria-valuemin={MIN_PALETTE}
          aria-valuemax={MAX_PALETTE}
          aria-valuenow={prefs.paletteWidth}
          tabIndex={0}
          onMouseDown={(event) => startResize('left', event.clientX)}
          onKeyDown={(event) => onSplitterKeyDown('left', event)}
        />
      ) : null}

      <section className={cn(styles.workspace, 'rf-builder-workspace')} data-testid="builder-canvas-workspace">
        <div className={styles.toolbar}>
          <div className={styles.panelActions}>
            <button
              type="button"
              className={cn(styles.panelActionButton, prefs.hidePalette ? styles.panelActionButtonActive : undefined)}
              onClick={() => setPrefs((current) => ({ ...current, hidePalette: !current.hidePalette }))}
              data-testid="builder-toggle-palette"
            >
              {prefs.hidePalette ? 'Show Palette' : 'Hide Palette'}
            </button>
            <button
              type="button"
              className={cn(styles.panelActionButton, prefs.hideInspector ? styles.panelActionButtonActive : undefined)}
              onClick={() => setPrefs((current) => ({ ...current, hideInspector: !current.hideInspector }))}
              data-testid="builder-toggle-inspector"
            >
              {prefs.hideInspector ? 'Show Inspector' : 'Hide Inspector'}
            </button>
            <button
              type="button"
              className={cn(styles.panelActionButton, hideBoth ? styles.panelActionButtonActive : undefined)}
              onClick={() =>
                setPrefs((current) => ({
                  ...current,
                  hidePalette: !hideBoth,
                  hideInspector: !hideBoth,
                }))
              }
              data-testid="builder-focus-canvas"
            >
              {hideBoth ? 'Exit Focus Mode' : 'Focus Canvas'}
            </button>
            <button
              type="button"
              className={styles.panelActionButton}
              onClick={resetLayout}
              data-testid="builder-reset-layout"
            >
              Reset Layout
            </button>
          </div>
          {canvasToolbar}
        </div>
        <div className={styles.viewport} data-testid="builder-canvas-viewport">
          {canvas}
        </div>
      </section>

      {showInspector ? (
        <div
          className={styles.splitter}
          data-testid="builder-splitter-right"
          role="separator"
          aria-label="Resize inspector panel"
          aria-orientation="vertical"
          aria-valuemin={MIN_INSPECTOR}
          aria-valuemax={MAX_INSPECTOR}
          aria-valuenow={prefs.inspectorWidth}
          tabIndex={0}
          onMouseDown={(event) => startResize('right', event.clientX)}
          onKeyDown={(event) => onSplitterKeyDown('right', event)}
        />
      ) : null}

      {showInspector ? (
        <aside className={cn(styles.sidePane, 'pf-surface-panel')} data-testid="builder-inspector-panel">
          {inspector}
        </aside>
      ) : null}
    </section>
  );
}
