import { describe, expect, it } from 'vitest';
import {
  createDefaultThemeConfig,
  exportThemeConfig,
  importThemeConfig,
  loadThemeConfig,
  migrateThemeConfig,
  saveThemeConfig,
  toRuntimeTheme,
  validateThemeConfig,
  type ThemeStorage,
} from '../src/index';

class MemoryStorage implements ThemeStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('@platform/theme-config', () => {
  it('migrates runtime-like theme snapshots to versioned config', () => {
    const migrated = migrateThemeConfig({
      mode: 'dark',
      density: 'comfortable',
      visual: '3d',
      brand: {
        primary: '#0055aa',
        secondary: '#663399',
        radiusScale: 1.4,
      },
    }, '2026-02-17T00:00:00.000Z');

    expect(migrated.version).toBe(2);
    expect(migrated.mode).toBe('dark');
    expect(migrated.density).toBe('cozy');
    expect(migrated.visual).toBe('3d');
    expect(migrated.brand.primary).toBe('#0055aa');
    expect(migrated.brand.secondary).toBe('#663399');
    expect(migrated.updatedAt).toBe('2026-02-17T00:00:00.000Z');
  });

  it('validates color and numeric bounds', () => {
    const result = validateThemeConfig({
      mode: 'light',
      density: 'compact',
      visual: 'flat',
      brand: {
        primary: 'invalid-color',
        secondary: '#12345',
        radiusScale: 4,
        elevationIntensity: 3,
        noise: 0.4,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('brand.primary'))).toBe(true);
    expect(result.errors.some((error) => error.includes('brand.secondary'))).toBe(true);
  });

  it('saves and loads validated theme config from storage', () => {
    const storage = new MemoryStorage();
    const base = createDefaultThemeConfig('2026-02-17T00:00:00.000Z');

    const saved = saveThemeConfig(storage, {
      ...base,
      visual: 'layered',
      brand: {
        ...base.brand,
        primary: '#1248ff',
        noise: 0.02,
      },
    });

    expect(saved.valid).toBe(true);
    expect(saved.value?.brand.primary).toBe('#1248ff');

    const loaded = loadThemeConfig(storage);
    expect(loaded).not.toBeNull();
    expect(loaded?.brand.primary).toBe('#1248ff');
    expect(toRuntimeTheme(loaded!).density).toBe('comfortable');
  });

  it('exports and imports a valid theme config payload', () => {
    const baseline = createDefaultThemeConfig('2026-02-17T00:00:00.000Z');
    const json = exportThemeConfig(baseline);
    const imported = importThemeConfig(json);

    expect(imported.valid).toBe(true);
    expect(imported.value?.visual).toBe('layered');
  });
});
