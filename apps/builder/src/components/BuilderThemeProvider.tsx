'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ComponentSystemProvider } from '@platform/component-system';
import {
  applyThemeTokens,
  defaultDarkTheme,
  defaultLightTheme,
  mergeTokenValues,
  type ThemeMode,
  type TokenValues,
} from '@platform/design-tokens';
import { builderTenantTheme } from '../lib/themes';

interface BuilderThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  tokens: TokenValues;
}

const BuilderThemeContext = createContext<BuilderThemeContextValue | null>(null);

const STORAGE_KEY = 'rf:builder-theme-mode:v1';

export function BuilderThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => resolveInitialMode());

  const tokens = useMemo(() => {
    const base = mode === 'dark' ? defaultDarkTheme : defaultLightTheme;
    const overrides = builderTenantTheme?.modes?.[mode];
    return mergeTokenValues(base, overrides);
  }, [mode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.style.colorScheme = mode;
    applyThemeTokens(root, tokens);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore storage errors
    }
  }, [mode, tokens]);

  const value = useMemo<BuilderThemeContextValue>(
    () => ({
      mode,
      tokens,
      setMode,
      toggleMode: () => setMode((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [mode, tokens],
  );

  return (
    <BuilderThemeContext.Provider value={value}>
      <ComponentSystemProvider>{children}</ComponentSystemProvider>
    </BuilderThemeContext.Provider>
  );
}

export function useBuilderTheme(): BuilderThemeContextValue {
  const context = useContext(BuilderThemeContext);
  if (!context) {
    throw new Error('useBuilderTheme must be used within BuilderThemeProvider.');
  }
  return context;
}

function resolveInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore storage errors
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
