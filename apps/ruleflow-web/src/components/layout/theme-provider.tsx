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
} from '@platform/ui-kit';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeDensity = 'comfortable' | 'compact';

type ThemeContextValue = {
  theme: Exclude<ThemeMode, 'system'>;
  density: ThemeDensity;
  brandPrimary?: string;
  setTheme: (theme: Exclude<ThemeMode, 'system'>) => void;
  setDensity: (density: ThemeDensity) => void;
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
  const { theme, setMode, setDensity, setBrand } = usePlatformTheme();

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: theme.mode,
      density: theme.density,
      brandPrimary: theme.brand?.primary,
      setTheme: setMode,
      setDensity,
      setBrandPrimary: (primary) => {
        setBrand({
          ...theme.brand,
          primary,
        });
      },
    }),
    [setBrand, setDensity, setMode, theme],
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

    return {
      mode,
      density,
      brand: {
        logoUrl: payload.branding.logoUrl,
        primary: payload.branding.primaryColor,
        secondary: payload.branding.secondaryColor,
        radiusScale,
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
