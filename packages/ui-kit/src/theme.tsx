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

export type PlatformThemeMode = 'light' | 'dark';
export type PlatformThemeDensity = 'comfortable' | 'cozy' | 'compact';
export type PlatformVisualStyle = 'flat' | 'layered' | '3d';

export type PlatformTheme = {
  mode: PlatformThemeMode;
  density: PlatformThemeDensity;
  visual: PlatformVisualStyle;
  brand?: {
    logoUrl?: string;
    faviconUrl?: string;
    primary?: string;
    secondary?: string;
    fontFamily?: string;
    radiusScale?: number;
    elevationIntensity?: number;
    noise?: number;
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
  setVisual: (visual: PlatformTheme['visual']) => void;
  setBrand: (brand: Partial<NonNullable<PlatformTheme['brand']>>) => void;
}

type VisualPreset = {
  elevationIntensity: number;
  noiseOpacity: number;
  lightX: string;
  lightY: string;
  highlightAlpha: number;
  shadowAlpha: number;
};

const DEFAULT_STORAGE_KEY = 'pf:theme:v1';

const VISUAL_PRESETS: Record<PlatformVisualStyle, VisualPreset> = {
  flat: {
    elevationIntensity: 0.75,
    noiseOpacity: 0,
    lightX: '18%',
    lightY: '12%',
    highlightAlpha: 0,
    shadowAlpha: 0,
  },
  layered: {
    elevationIntensity: 1,
    noiseOpacity: 0.03,
    lightX: '18%',
    lightY: '12%',
    highlightAlpha: 0.36,
    shadowAlpha: 0.16,
  },
  '3d': {
    elevationIntensity: 1.28,
    noiseOpacity: 0.045,
    lightX: '14%',
    lightY: '8%',
    highlightAlpha: 0.42,
    shadowAlpha: 0.22,
  },
};

const DEFAULT_BACKGROUNDS: Record<PlatformThemeMode, { bg0: string; bg1: string; bg2: string }> = {
  light: {
    bg0: '#edf2fa',
    bg1: '#f7f9fd',
    bg2: '#e8edf7',
  },
  dark: {
    bg0: '#09101a',
    bg1: '#111b2a',
    bg2: '#182436',
  },
};

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
    setThemeState((current) => mergeTheme(current, stored));
  }, [storageKey]);

  useEffect(() => {
    if (!tenantThemeLoader) return;
    let cancelled = false;
    tenantThemeLoader().then((tenantTheme) => {
      if (!tenantTheme || cancelled) return;
      setThemeState((current) => mergeTheme(current, tenantTheme));
    });
    return () => {
      cancelled = true;
    };
  }, [tenantThemeLoader]);

  const vars = useMemo(() => createThemeVars(theme), [theme]);

  useEffect(() => {
    const element = resolveTarget(target);
    if (!element) return;
    const densityAttribute = normalizeDensityAttribute(theme.density);
    element.setAttribute('data-theme', theme.mode);
    element.setAttribute('data-density', densityAttribute);
    element.setAttribute('data-visual', theme.visual);
    applyThemeVars(element, vars);

    if (typeof document !== 'undefined' && element === document.documentElement) {
      document.body?.setAttribute('data-theme', theme.mode);
      document.body?.setAttribute('data-density', densityAttribute);
      document.body?.setAttribute('data-visual', theme.visual);
    }

    writeStoredTheme(storageKey, theme);
  }, [theme, vars, target, storageKey]);

  const value = useMemo<PlatformThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => {
        setThemeState((current) => mergeTheme(current, next));
      },
      setMode: (mode) => setThemeState((current) => mergeTheme(current, { mode })),
      setDensity: (density) => setThemeState((current) => mergeTheme(current, { density })),
      setVisual: (visual) => setThemeState((current) => mergeTheme(current, { visual })),
      setBrand: (brand) => setThemeState((current) => mergeTheme(current, { brand })),
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
  const mode = normalizeMode(theme.mode);
  const density = normalizeDensity(theme.density);
  const visual = normalizeVisual(theme.visual);

  const tokens = getDesignTokensForMode(mode);
  const vars = tokensToCssVars(tokens, density);

  vars['--pf-density'] = normalizeDensityAttribute(theme.density);
  vars['--pf-visual-style'] = visual;

  if (theme.brand?.primary) {
    const primaryScale = deriveColorScale(theme.brand.primary);
    applyScale(vars, 'primary', primaryScale);
    applyBackgroundScale(vars, primaryScale, mode);
  } else {
    const fallback = DEFAULT_BACKGROUNDS[mode];
    vars['--pf-bg-0'] = fallback.bg0;
    vars['--pf-bg-1'] = fallback.bg1;
    vars['--pf-bg-2'] = fallback.bg2;
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

  vars['--pf-brand-logo-url'] = theme.brand?.logoUrl ? `url("${theme.brand.logoUrl}")` : '';
  vars['--pf-brand-favicon-url'] = theme.brand?.faviconUrl ? `url("${theme.brand.faviconUrl}")` : '';

  const preset = VISUAL_PRESETS[visual];
  vars['--pf-light-x'] = preset.lightX;
  vars['--pf-light-y'] = preset.lightY;
  vars['--pf-elevation-intensity'] = formatNumber(
    clamp(theme.brand?.elevationIntensity ?? preset.elevationIntensity, 0.6, 1.8),
  );
  vars['--pf-noise-opacity'] = formatNumber(clamp(theme.brand?.noise ?? preset.noiseOpacity, 0, 0.08), 3);

  const primaryScale = theme.brand?.primary ? deriveColorScale(theme.brand.primary) : null;
  const highlightHex = mode === 'dark' ? (primaryScale?.[200] ?? '#8eafff') : '#ffffff';
  const shadowHex = mode === 'dark' ? '#000000' : (primaryScale?.[900] ?? '#1c2537');

  vars['--pf-bg-highlight'] = rgbToCssAlpha(hexToRgb(highlightHex), preset.highlightAlpha);
  vars['--pf-bg-shadow'] = rgbToCssAlpha(hexToRgb(shadowHex), preset.shadowAlpha);

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
    const mixed =
      amount >= 0
        ? mixRgb(rgb, { r: 255, g: 255, b: 255 }, amount)
        : mixRgb(rgb, { r: 0, g: 0, b: 0 }, Math.abs(amount));
    scale[step] = rgbToHex(mixed.r, mixed.g, mixed.b);
  }

  return scale as ColorScale;
}

export { platformThemeInitScript };

function resolveInitialTheme(initialTheme?: Partial<PlatformTheme>): PlatformTheme {
  const preferredMode = resolvePreferredMode();
  const base: PlatformTheme = {
    mode: preferredMode,
    density: 'comfortable',
    visual: 'layered',
    brand: {},
  };
  return mergeTheme(base, initialTheme);
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
    const parsed = JSON.parse(raw) as Partial<PlatformTheme>;
    return sanitizeThemePatch(parsed);
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

function applyBackgroundScale(
  vars: Record<string, string>,
  scale: ColorScale,
  mode: PlatformThemeMode,
): void {
  if (mode === 'dark') {
    vars['--pf-bg-0'] = mixHex(scale[900], '#09101a', 0.78);
    vars['--pf-bg-1'] = mixHex(scale[800], '#111b2a', 0.8);
    vars['--pf-bg-2'] = mixHex(scale[700], '#182436', 0.82);
    return;
  }

  vars['--pf-bg-0'] = mixHex(scale[50], '#edf2fa', 0.72);
  vars['--pf-bg-1'] = mixHex(scale[100], '#f7f9fd', 0.82);
  vars['--pf-bg-2'] = mixHex(scale[200], '#e8edf7', 0.84);
}

function mergeTheme(base: PlatformTheme, patch?: Partial<PlatformTheme>): PlatformTheme {
  const safePatch = sanitizeThemePatch(patch);
  const merged: PlatformTheme = {
    ...base,
    ...safePatch,
    mode: normalizeMode(safePatch.mode ?? base.mode),
    density: normalizeDensityInput(safePatch.density ?? base.density),
    visual: normalizeVisual(safePatch.visual ?? base.visual),
    brand: {
      ...(base.brand ?? {}),
      ...(safePatch.brand ?? {}),
    },
  };
  return merged;
}

function sanitizeThemePatch(patch?: Partial<PlatformTheme>): Partial<PlatformTheme> {
  if (!patch) return {};
  const next: Partial<PlatformTheme> = {};

  if (patch.mode) {
    next.mode = normalizeMode(patch.mode);
  }
  if (patch.density) {
    next.density = normalizeDensityInput(patch.density);
  }
  if (patch.visual) {
    next.visual = normalizeVisual(patch.visual);
  }

  if (patch.brand) {
    next.brand = {
      logoUrl: patch.brand.logoUrl,
      faviconUrl: patch.brand.faviconUrl,
      primary: patch.brand.primary,
      secondary: patch.brand.secondary,
      fontFamily: patch.brand.fontFamily,
      radiusScale:
        typeof patch.brand.radiusScale === 'number' && Number.isFinite(patch.brand.radiusScale)
          ? clamp(patch.brand.radiusScale, 0.5, 2)
          : undefined,
      elevationIntensity:
        typeof patch.brand.elevationIntensity === 'number' && Number.isFinite(patch.brand.elevationIntensity)
          ? clamp(patch.brand.elevationIntensity, 0.6, 1.8)
          : undefined,
      noise:
        typeof patch.brand.noise === 'number' && Number.isFinite(patch.brand.noise)
          ? clamp(patch.brand.noise, 0, 0.08)
          : undefined,
    };
  }

  return next;
}

function normalizeMode(mode: string | undefined): PlatformThemeMode {
  return mode === 'dark' ? 'dark' : 'light';
}

function normalizeVisual(visual: string | undefined): PlatformVisualStyle {
  if (visual === 'flat' || visual === 'layered' || visual === '3d') return visual;
  return 'layered';
}

function normalizeDensityInput(density: string | undefined): PlatformThemeDensity {
  if (density === 'compact') return 'compact';
  if (density === 'cozy') return 'cozy';
  return 'comfortable';
}

function normalizeDensity(density: PlatformThemeDensity): 'comfortable' | 'compact' {
  return density === 'compact' ? 'compact' : 'comfortable';
}

function normalizeDensityAttribute(density: PlatformThemeDensity): 'comfortable' | 'compact' | 'cozy' {
  if (density === 'compact') return 'compact';
  if (density === 'cozy') return 'cozy';
  return 'comfortable';
}

function scalePx(raw: string | undefined, multiplier: number): string {
  if (!raw) return '0px';
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value)) return raw;
  return `${Math.round(value * multiplier)}px`;
}

function mixHex(a: string, b: string, ratioToB: number): string {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  const mixed = mixRgb(rgbA, rgbB, ratioToB);
  return rgbToHex(mixed.r, mixed.g, mixed.b);
}

function rgbToCssAlpha(rgb: { r: number; g: number; b: number }, alpha: number): string {
  const clamped = clamp(alpha, 0, 1);
  return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${Math.round(clamped * 100)}%)`;
}

function formatNumber(value: number, digits = 2): string {
  return Number(value.toFixed(digits)).toString();
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
