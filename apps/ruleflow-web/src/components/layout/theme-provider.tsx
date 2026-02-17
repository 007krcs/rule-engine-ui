'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  PlatformThemeProvider,
  usePlatformTheme,
  type PlatformTheme,
  type PlatformVisualStyle,
} from '@platform/ui-kit';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeDensity = 'comfortable' | 'compact';
export type ThemeVisual = PlatformVisualStyle;

type ThemeContextValue = {
  theme: Exclude<ThemeMode, 'system'>;
  density: ThemeDensity;
  visual: ThemeVisual;
  brandPrimary?: string;
  setTheme: (theme: Exclude<ThemeMode, 'system'>) => void;
  setDensity: (density: ThemeDensity) => void;
  setVisual: (visual: ThemeVisual) => void;
  setBrandPrimary: (primary: string) => void;
};

type TenantBranding = {
  logoUrl?: string;
  mode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  typographyScale: number;
  radius: number;
  spacing: number;
  cssVariables: Record<string, unknown>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: ReactNode;
  defaultTheme?: ThemeMode;
}) {
  const initialTheme = useMemo<Partial<PlatformTheme> | undefined>(() => {
    if (defaultTheme === 'system') return undefined;
    return { mode: defaultTheme };
  }, [defaultTheme]);

  return (
    <PlatformThemeProvider initialTheme={initialTheme} tenantThemeLoader={loadTenantTheme}>
      <ThemeBridge>{children}</ThemeBridge>
    </PlatformThemeProvider>
  );
}

function ThemeBridge({ children }: { children: ReactNode }) {
  const { theme, setMode, setDensity, setVisual, setBrand } = usePlatformTheme();

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: theme.mode,
      density: theme.density === 'compact' ? 'compact' : 'comfortable',
      visual: theme.visual,
      brandPrimary: theme.brand?.primary,
      setTheme: setMode,
      setDensity,
      setVisual,
      setBrandPrimary: (primary) => {
        setBrand({
          ...theme.brand,
          primary,
        });
      },
    }),
    [setBrand, setDensity, setMode, setVisual, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider.');
  }
  return context;
}

async function loadTenantTheme(): Promise<Partial<PlatformTheme> | null> {
  try {
    const response = await fetch('/api/branding', { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = (await response.json()) as { ok?: boolean; branding?: TenantBranding | null };
    if (!payload?.ok || !payload.branding) return null;

    const mode = resolveTenantMode(payload.branding.mode);
    const density: ThemeDensity = payload.branding.spacing <= 7 ? 'compact' : 'comfortable';
    const radiusScale = clamp(payload.branding.radius / 10, 0.5, 2);
    const visual = resolveVisualStyle(payload.branding.cssVariables);
    const elevationIntensity = resolveNumberVar(payload.branding.cssVariables, '--pf-elevation-intensity');
    const noise = resolveNumberVar(payload.branding.cssVariables, '--pf-noise-opacity');
    const fontFamily = resolveStringVar(payload.branding.cssVariables, '--pf-font-sans');

    return {
      mode,
      density,
      visual,
      brand: {
        logoUrl: payload.branding.logoUrl,
        primary: payload.branding.primaryColor,
        secondary: payload.branding.secondaryColor,
        fontFamily: fontFamily ?? undefined,
        radiusScale,
        elevationIntensity: elevationIntensity ?? undefined,
        noise: noise ?? undefined,
      },
    };
  } catch {
    return null;
  }
}

function resolveTenantMode(mode: ThemeMode): Exclude<ThemeMode, 'system'> {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveVisualStyle(cssVariables: Record<string, unknown> | undefined): ThemeVisual {
  const value = cssVariables?.['--pf-visual-style'];
  if (value === 'flat' || value === 'layered' || value === '3d') return value;
  return 'layered';
}

function resolveNumberVar(
  cssVariables: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = cssVariables?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolveStringVar(
  cssVariables: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = cssVariables?.[key];
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}
