import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { platformThemeInitScript } from './theme-init';
import {
  getDesignTokensForMode,
  tokensToCssVars,
  type ColorScale,
} from './tokens';

export type PlatformTheme = {
  mode: 'light' | 'dark';
  density: 'comfortable' | 'compact';
  brand?: {
    logoUrl?: string;
    primary?: string;
    secondary?: string;
    fontFamily?: string;
    radiusScale?: number;
  };
};

export interface PlatformThemeProviderProps {
  children: ReactNode;
  initialTheme?: Partial<PlatformTheme>;
  target?: HTMLElement | null;
  storageKey?: string;
  tenantThemeLoader?: () => Promise<Partial<PlatformTheme> | null | undefined>;
}

export interface PlatformThemeContextValue {
  theme: PlatformTheme;
  setTheme: (theme: Partial<PlatformTheme>) => void;
  setMode: (mode: PlatformTheme['mode']) => void;
  setDensity: (density: PlatformTheme['density']) => void;
  setBrand: (brand: PlatformTheme['brand']) => void;
}

const DEFAULT_STORAGE_KEY = 'pf:theme:v1';

const ThemeContext = createContext<PlatformThemeContextValue | null>(null);

export function PlatformThemeProvider({
  children,
  initialTheme,
  target,
  storageKey = DEFAULT_STORAGE_KEY,
  tenantThemeLoader,
}: PlatformThemeProviderProps) {
  const [theme, setThemeState] = useState<PlatformTheme>(() =>
    resolveInitialTheme(initialTheme),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = readStoredTheme(storageKey);
    if (!stored) return;
    setThemeState((current) => ({ ...current, ...stored, brand: { ...current.brand, ...stored.brand } }));
  }, [storageKey]);

  useEffect(() => {
    if (!tenantThemeLoader) return;
    let cancelled = false;
    tenantThemeLoader().then((tenantTheme) => {
      if (!tenantTheme || cancelled) return;
      setThemeState((current) => ({
        ...current,
        ...tenantTheme,
        brand: {
          ...current.brand,
          ...(tenantTheme.brand ?? {}),
        },
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [tenantThemeLoader]);

  const vars = useMemo(() => createThemeVars(theme), [theme]);

  useEffect(() => {
    const element = resolveTarget(target);
    if (!element) return;
    element.setAttribute('data-theme', theme.mode);
    element.setAttribute('data-density', theme.density);
    applyThemeVars(element, vars);
    writeStoredTheme(storageKey, theme);
  }, [theme, vars, target, storageKey]);

  const value = useMemo<PlatformThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => {
        setThemeState((current) => ({
          ...current,
          ...next,
          brand: {
            ...current.brand,
            ...(next.brand ?? {}),
          },
        }));
      },
      setMode: (mode) => setThemeState((current) => ({ ...current, mode })),
      setDensity: (density) => setThemeState((current) => ({ ...current, density })),
      setBrand: (brand) => setThemeState((current) => ({ ...current, brand })),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function usePlatformTheme(): PlatformThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('usePlatformTheme must be used within PlatformThemeProvider.');
  }
  return context;
}

export function createThemeVars(theme: PlatformTheme): Record<string, string> {
  const tokens = getDesignTokensForMode(theme.mode);
  const vars = tokensToCssVars(tokens, theme.density);

  if (theme.brand?.primary) {
    const primaryScale = deriveColorScale(theme.brand.primary);
    applyScale(vars, 'primary', primaryScale);
  }

  if (theme.brand?.secondary) {
    const secondaryScale = deriveColorScale(theme.brand.secondary);
    applyScale(vars, 'secondary', secondaryScale);
  }

  if (theme.brand?.fontFamily) {
    vars['--pf-font-sans'] = theme.brand.fontFamily;
  }

  if (theme.brand?.radiusScale && Number.isFinite(theme.brand.radiusScale)) {
    const multiplier = clamp(theme.brand.radiusScale, 0.5, 2);
    vars['--pf-radius-xs'] = scalePx(vars['--pf-radius-xs'], multiplier);
    vars['--pf-radius-sm'] = scalePx(vars['--pf-radius-sm'], multiplier);
    vars['--pf-radius-md'] = scalePx(vars['--pf-radius-md'], multiplier);
    vars['--pf-radius-lg'] = scalePx(vars['--pf-radius-lg'], multiplier);
    vars['--pf-radius-xl'] = scalePx(vars['--pf-radius-xl'], multiplier);
    vars['--pf-radius-2xl'] = scalePx(vars['--pf-radius-2xl'], multiplier);
  }

  if (theme.brand?.logoUrl) {
    vars['--pf-brand-logo-url'] = `url("${theme.brand.logoUrl}")`;
  }

  return vars;
}

export function applyThemeVars(element: HTMLElement, vars: Record<string, string>): void {
  for (const [name, value] of Object.entries(vars)) {
    element.style.setProperty(name, value);
  }
}

export function deriveColorScale(hex: string): ColorScale {
  const rgb = hexToRgb(hex);
  const steps: Array<[keyof ColorScale, number]> = [
    [50, 0.93],
    [100, 0.84],
    [200, 0.68],
    [300, 0.48],
    [400, 0.24],
    [500, 0],
    [600, -0.13],
    [700, -0.27],
    [800, -0.4],
    [900, -0.53],
  ];

  const scale: Partial<ColorScale> = {};
  for (const [step, amount] of steps) {
    const mixed = amount >= 0 ? mixRgb(rgb, { r: 255, g: 255, b: 255 }, amount) : mixRgb(rgb, { r: 0, g: 0, b: 0 }, Math.abs(amount));
    scale[step] = rgbToHex(mixed.r, mixed.g, mixed.b);
  }

  return scale as ColorScale;
}

export { platformThemeInitScript };

function resolveInitialTheme(initialTheme?: Partial<PlatformTheme>): PlatformTheme {
  const preferredMode = resolvePreferredMode();
  return {
    mode: initialTheme?.mode ?? preferredMode,
    density: initialTheme?.density ?? 'comfortable',
    brand: initialTheme?.brand,
  };
}

function resolvePreferredMode(): PlatformTheme['mode'] {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(storageKey: string): Partial<PlatformTheme> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PlatformTheme>;
  } catch {
    return null;
  }
}

function writeStoredTheme(storageKey: string, theme: PlatformTheme): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(theme));
}

function resolveTarget(target?: HTMLElement | null): HTMLElement | null {
  if (target) return target;
  if (typeof document === 'undefined') return null;
  return document.documentElement;
}

function applyScale(vars: Record<string, string>, name: string, scale: ColorScale): void {
  for (const [step, value] of Object.entries(scale)) {
    vars[`--pf-color-${name}-${step}`] = value;
  }
}

function scalePx(raw: string | undefined, multiplier: number): string {
  if (!raw) return '0px';
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value)) return raw;
  return `${Math.round(value * multiplier)}px`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex);
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

function normalizeHex(hex: string): string {
  const trimmed = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return trimmed
      .split('')
      .map((token) => `${token}${token}`)
      .join('')
      .toLowerCase();
  }
  throw new Error(`Invalid hex color: "${hex}".`);
}

function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  ratio: number,
): { r: number; g: number; b: number } {
  const clamped = clamp(ratio, 0, 1);
  return {
    r: Math.round(a.r + (b.r - a.r) * clamped),
    g: Math.round(a.g + (b.g - a.g) * clamped),
    b: Math.round(a.b + (b.b - a.b) * clamped),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}
