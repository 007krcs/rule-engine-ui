export const THEME_CONFIG_VERSION = 2 as const;
export const DEFAULT_THEME_CONFIG_STORAGE_KEY = 'rf:tenant-theme:v1';

export type ThemeMode = 'light' | 'dark';
export type ThemeDensity = 'cozy' | 'compact';
export type ThemeVisualStyle = 'flat' | 'layered' | '3d';

export interface ThemeBranding {
  logoUrl?: string;
  faviconUrl?: string;
  primary: string;
  secondary: string;
  fontFamily: string;
  radiusScale: number;
  elevationIntensity: number;
  noise: number;
}

export interface ThemeConfig {
  version: typeof THEME_CONFIG_VERSION;
  mode: ThemeMode;
  density: ThemeDensity;
  visual: ThemeVisualStyle;
  brand: ThemeBranding;
  updatedAt: string;
}

export interface ThemeRuntimeSnapshot {
  mode: ThemeMode;
  density: 'comfortable' | 'cozy' | 'compact';
  visual: ThemeVisualStyle;
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
}

export interface ThemeConfigValidationResult {
  valid: boolean;
  errors: string[];
  value?: ThemeConfig;
}

export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface ThemeConfigRepository {
  load: () => Promise<ThemeConfig | null>;
  save: (input: unknown) => Promise<ThemeConfigValidationResult>;
  clear: () => Promise<void>;
}

const DEFAULT_THEME: Omit<ThemeConfig, 'updatedAt'> = {
  version: THEME_CONFIG_VERSION,
  mode: 'light',
  density: 'cozy',
  visual: 'layered',
  brand: {
    primary: '#2f6af5',
    secondary: '#8b52f3',
    fontFamily: '"Plus Jakarta Sans", "Avenir Next", "Segoe UI", Arial, sans-serif',
    radiusScale: 1,
    elevationIntensity: 1,
    noise: 0.03,
  },
};

const VISUAL_DEFAULTS: Record<ThemeVisualStyle, { elevationIntensity: number; noise: number }> = {
  flat: { elevationIntensity: 0.75, noise: 0 },
  layered: { elevationIntensity: 1, noise: 0.03 },
  '3d': { elevationIntensity: 1.28, noise: 0.045 },
};

export function createDefaultThemeConfig(now = new Date().toISOString()): ThemeConfig {
  return {
    ...DEFAULT_THEME,
    brand: { ...DEFAULT_THEME.brand },
    updatedAt: now,
  };
}

export function migrateThemeConfig(input: unknown, now = new Date().toISOString()): ThemeConfig {
  const defaults = createDefaultThemeConfig(now);
  if (!isRecord(input)) return defaults;

  const source = input;
  const brandSource = isRecord(source.brand) ? source.brand : source;

  const visual = toVisual(source.visual, defaults.visual);
  const visualDefaults = VISUAL_DEFAULTS[visual];

  const primary = toHex(brandSource.primary, defaults.brand.primary);
  const secondary = toHex(brandSource.secondary, defaults.brand.secondary);

  return {
    version: THEME_CONFIG_VERSION,
    mode: toMode(source.mode, defaults.mode),
    density: toDensity(source.density, defaults.density),
    visual,
    brand: {
      logoUrl: toOptionalString(brandSource.logoUrl),
      faviconUrl: toOptionalString(brandSource.faviconUrl),
      primary,
      secondary,
      fontFamily: toStringOrDefault(brandSource.fontFamily, defaults.brand.fontFamily),
      radiusScale: clampNumber(brandSource.radiusScale, 0.5, 2, defaults.brand.radiusScale),
      elevationIntensity: clampNumber(
        brandSource.elevationIntensity,
        0.6,
        1.8,
        visualDefaults.elevationIntensity,
      ),
      noise: clampNumber(brandSource.noise, 0, 0.08, visualDefaults.noise),
    },
    updatedAt: toIsoDate(source.updatedAt, now),
  };
}

export function validateThemeConfig(input: unknown): ThemeConfigValidationResult {
  const errors: string[] = [];
  const value = migrateThemeConfig(input);
  const source = isRecord(input) ? input : null;
  const brandSource = source && isRecord(source.brand) ? source.brand : null;

  if (brandSource && !isHexCandidate(brandSource.primary)) {
    errors.push('brand.primary must be a valid hex color.');
  }
  if (brandSource && !isHexCandidate(brandSource.secondary)) {
    errors.push('brand.secondary must be a valid hex color.');
  }
  if (!isHexColor(value.brand.primary)) {
    errors.push('brand.primary must be a valid hex color.');
  }
  if (!isHexColor(value.brand.secondary)) {
    errors.push('brand.secondary must be a valid hex color.');
  }
  if (brandSource && 'fontFamily' in brandSource && !isNonEmptyString(brandSource.fontFamily)) {
    errors.push('brand.fontFamily is required.');
  }
  if (value.brand.fontFamily.trim().length === 0) {
    errors.push('brand.fontFamily is required.');
  }
  if (brandSource && hasNumberishField(brandSource, 'radiusScale')) {
    const parsed = toNumber(brandSource.radiusScale);
    if (parsed === null || parsed < 0.5 || parsed > 2) {
      errors.push('brand.radiusScale must be between 0.5 and 2.');
    }
  }
  if (value.brand.radiusScale < 0.5 || value.brand.radiusScale > 2) {
    errors.push('brand.radiusScale must be between 0.5 and 2.');
  }
  if (brandSource && hasNumberishField(brandSource, 'elevationIntensity')) {
    const parsed = toNumber(brandSource.elevationIntensity);
    if (parsed === null || parsed < 0.6 || parsed > 1.8) {
      errors.push('brand.elevationIntensity must be between 0.6 and 1.8.');
    }
  }
  if (value.brand.elevationIntensity < 0.6 || value.brand.elevationIntensity > 1.8) {
    errors.push('brand.elevationIntensity must be between 0.6 and 1.8.');
  }
  if (brandSource && hasNumberishField(brandSource, 'noise')) {
    const parsed = toNumber(brandSource.noise);
    if (parsed === null || parsed < 0 || parsed > 0.08) {
      errors.push('brand.noise must be between 0 and 0.08.');
    }
  }
  if (value.brand.noise < 0 || value.brand.noise > 0.08) {
    errors.push('brand.noise must be between 0 and 0.08.');
  }

  return {
    valid: errors.length === 0,
    errors,
    value,
  };
}

export function loadThemeConfig(
  storage: ThemeStorage,
  key = DEFAULT_THEME_CONFIG_STORAGE_KEY,
): ThemeConfig | null {
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = validateThemeConfig(parsed);
    return result.valid && result.value ? result.value : null;
  } catch {
    return null;
  }
}

export function saveThemeConfig(
  storage: ThemeStorage,
  input: unknown,
  key = DEFAULT_THEME_CONFIG_STORAGE_KEY,
): ThemeConfigValidationResult {
  const result = validateThemeConfig(input);
  if (!result.valid || !result.value) {
    return result;
  }

  const next: ThemeConfig = {
    ...result.value,
    updatedAt: new Date().toISOString(),
  };
  storage.setItem(key, JSON.stringify(next, null, 2));
  return {
    valid: true,
    errors: [],
    value: next,
  };
}

export function clearThemeConfig(
  storage: ThemeStorage,
  key = DEFAULT_THEME_CONFIG_STORAGE_KEY,
): void {
  storage.removeItem(key);
}

export function createLocalStorageThemeConfigRepository(
  storage: ThemeStorage,
  key = DEFAULT_THEME_CONFIG_STORAGE_KEY,
): ThemeConfigRepository {
  return {
    load: async () => loadThemeConfig(storage, key),
    save: async (input) => saveThemeConfig(storage, input, key),
    clear: async () => {
      clearThemeConfig(storage, key);
    },
  };
}

export function exportThemeConfig(input: unknown): string {
  const result = validateThemeConfig(input);
  if (!result.valid || !result.value) {
    throw new Error(`Invalid theme config: ${result.errors.join(' ')}`);
  }
  return JSON.stringify(result.value, null, 2);
}

export function importThemeConfig(raw: string): ThemeConfigValidationResult {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return validateThemeConfig(parsed);
  } catch {
    return {
      valid: false,
      errors: ['Theme JSON is invalid.'],
    };
  }
}

export function toRuntimeTheme(config: ThemeConfig): ThemeRuntimeSnapshot {
  return {
    mode: config.mode,
    density: config.density === 'cozy' ? 'comfortable' : 'compact',
    visual: config.visual,
    brand: {
      logoUrl: config.brand.logoUrl,
      faviconUrl: config.brand.faviconUrl,
      primary: config.brand.primary,
      secondary: config.brand.secondary,
      fontFamily: config.brand.fontFamily,
      radiusScale: config.brand.radiusScale,
      elevationIntensity: config.brand.elevationIntensity,
      noise: config.brand.noise,
    },
  };
}

export function fromRuntimeTheme(theme: ThemeRuntimeSnapshot): ThemeConfig {
  return migrateThemeConfig({
    mode: theme.mode,
    density: theme.density,
    visual: theme.visual,
    brand: theme.brand,
  });
}

function toMode(value: unknown, fallback: ThemeMode): ThemeMode {
  return value === 'dark' ? 'dark' : fallback;
}

function toDensity(value: unknown, fallback: ThemeDensity): ThemeDensity {
  if (value === 'compact') return 'compact';
  if (value === 'cozy' || value === 'comfortable') return 'cozy';
  return fallback;
}

function toVisual(value: unknown, fallback: ThemeVisualStyle): ThemeVisualStyle {
  if (value === 'flat' || value === 'layered' || value === '3d') return value;
  return fallback;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function toStringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function toHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = normalizeHex(value);
  return normalized ?? fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(value, min, max);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return clamp(parsed, min, max);
    }
  }
  return fallback;
}

function toIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toISOString() : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeHex(value: string): string | null {
  const raw = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const body = raw.slice(1);
    return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`.toLowerCase();
  }
  return null;
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function isHexCandidate(value: unknown): boolean {
  return typeof value === 'string' && normalizeHex(value) !== null;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function hasNumberishField(
  value: Record<string, unknown>,
  field: 'radiusScale' | 'elevationIntensity' | 'noise',
): boolean {
  return field in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
