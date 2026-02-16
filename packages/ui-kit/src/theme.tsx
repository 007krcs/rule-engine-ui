import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DeepPartial, Density, PlatformTheme, ThemeMode } from './tokens';
import {
  compileThemeToCssVariables,
  createPlatformTheme,
  defaultDarkTheme,
  defaultTheme,
} from './tokens';

export type TenantThemeLoader = () =>
  | Promise<DeepPartial<PlatformTheme> | null | undefined>
  | DeepPartial<PlatformTheme>
  | null
  | undefined;

export interface ApplyPlatformThemeOptions {
  target?: HTMLElement | null;
  mode?: ThemeMode;
}

export async function loadTenantTheme(
  loader: TenantThemeLoader,
  base: PlatformTheme = defaultTheme,
): Promise<PlatformTheme> {
  const loaded = await loader();
  return createPlatformTheme(loaded ?? {}, base);
}

export function applyPlatformTheme(
  theme: PlatformTheme,
  options: ApplyPlatformThemeOptions = {},
): void {
  const target = resolveThemeTarget(options.target);
  if (!target) return;

  const vars = compileThemeToCssVariables(theme);
  for (const [name, value] of Object.entries(vars)) {
    target.style.setProperty(name, value);
  }

  target.setAttribute('data-density', theme.density);
  if (options.mode) {
    target.setAttribute('data-theme', options.mode);
  }
}

export interface PlatformThemeProviderProps {
  children: ReactNode;
  theme?: PlatformTheme;
  initialMode?: ThemeMode;
  initialDensity?: Density;
  target?: HTMLElement | null;
  tenantThemeLoader?: TenantThemeLoader;
}

export interface PlatformThemeContextValue {
  theme: PlatformTheme;
  mode: ThemeMode;
  density: Density;
  setMode: (mode: ThemeMode) => void;
  setDensity: (density: Density) => void;
  reloadTenantTheme: () => Promise<void>;
}

const ThemeContext = createContext<PlatformThemeContextValue | null>(null);

export function PlatformThemeProvider({
  children,
  theme,
  initialMode = 'light',
  initialDensity,
  target,
  tenantThemeLoader,
}: PlatformThemeProviderProps) {
  const [baseTheme, setBaseTheme] = useState<PlatformTheme>(() => theme ?? defaultTheme);
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [density, setDensity] = useState<Density>(initialDensity ?? baseTheme.density);

  useEffect(() => {
    if (!theme) return;
    setBaseTheme(theme);
  }, [theme]);

  const reloadTenantTheme = async (): Promise<void> => {
    if (!tenantThemeLoader) return;
    const nextTheme = await loadTenantTheme(tenantThemeLoader, theme ?? defaultTheme);
    setBaseTheme(nextTheme);
    if (!initialDensity) {
      setDensity(nextTheme.density);
    }
  };

  useEffect(() => {
    if (!tenantThemeLoader) return;
    let cancelled = false;
    loadTenantTheme(tenantThemeLoader, theme ?? defaultTheme).then((tenantTheme) => {
      if (cancelled) return;
      setBaseTheme(tenantTheme);
      if (!initialDensity) {
        setDensity(tenantTheme.density);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tenantThemeLoader, theme, initialDensity]);

  const effectiveTheme = useMemo(() => {
    const denseOverride: DeepPartial<PlatformTheme> = { density };
    if (mode === 'dark') {
      const darkBase = createPlatformTheme(
        {
          brand: baseTheme.brand,
          typography: baseTheme.typography,
          spacing: baseTheme.spacing,
          shape: baseTheme.shape,
          motion: baseTheme.motion,
        },
        defaultDarkTheme,
      );
      return createPlatformTheme(denseOverride, darkBase);
    }
    return createPlatformTheme(denseOverride, baseTheme);
  }, [baseTheme, density, mode]);

  useEffect(() => {
    applyPlatformTheme(effectiveTheme, { target, mode });
  }, [effectiveTheme, mode, target]);

  const contextValue = useMemo<PlatformThemeContextValue>(
    () => ({
      theme: effectiveTheme,
      mode,
      density,
      setMode,
      setDensity,
      reloadTenantTheme,
    }),
    [density, effectiveTheme, mode],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function usePlatformTheme(): PlatformThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('usePlatformTheme must be used within PlatformThemeProvider.');
  }
  return context;
}

function resolveThemeTarget(target?: HTMLElement | null): HTMLElement | null {
  if (target) return target;
  if (typeof document === 'undefined') return null;
  return document.documentElement;
}
