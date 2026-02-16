'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
};

type TenantBranding = {
  mode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  typographyScale: number;
  radius: number;
  spacing: number;
  cssVariables: Record<string, unknown>;
};

const THEME_STORAGE_KEY = 'ruleflow-theme';

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => undefined,
});

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
}) {
  const [theme, setTheme] = useState<ThemeMode>(defaultTheme);
  const [branding, setBranding] = useState<TenantBranding | null>(null);

  useEffect(() => {
    let canceled = false;

    const boot = async () => {
      const stored = readStoredTheme();
      if (stored) {
        setTheme(stored);
      }

      try {
        const response = await fetch('/api/branding', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { ok?: boolean; branding?: TenantBranding | null };
        if (canceled || !data || data.ok !== true) return;
        setBranding(data.branding ?? null);
        if (!stored && data.branding?.mode) {
          setTheme(data.branding.mode);
        }
      } catch {
        // Branding endpoint is optional in demo mode.
      }
    };

    void boot();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    applyTheme(theme, branding);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, branding]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

function readStoredTheme(): ThemeMode | null {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : null;
}

function applyTheme(theme: ThemeMode, branding: TenantBranding | null): void {
  const root = document.documentElement;
  const resolved = theme === 'system' && branding?.mode ? branding.mode : theme;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = resolved === 'dark' || (resolved === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);

  if (!branding) return;

  root.style.setProperty('--tenant-primary-color', branding.primaryColor);
  root.style.setProperty('--tenant-secondary-color', branding.secondaryColor);
  root.style.setProperty('--tenant-typography-scale', String(branding.typographyScale));
  root.style.setProperty('--tenant-radius', `${branding.radius}px`);
  root.style.setProperty('--tenant-spacing', `${branding.spacing}px`);

  for (const [key, value] of Object.entries(branding.cssVariables ?? {})) {
    if (!key.startsWith('--')) continue;
    if (typeof value === 'string' || typeof value === 'number') {
      root.style.setProperty(key, String(value));
    }
  }
}
