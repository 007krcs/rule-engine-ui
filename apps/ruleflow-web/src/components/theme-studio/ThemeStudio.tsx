'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  createDefaultThemeConfig,
  createLocalStorageThemeConfigRepository,
  exportThemeConfig,
  fromRuntimeTheme,
  importThemeConfig,
  toRuntimeTheme,
  type ThemeConfig,
  type ThemeConfigRepository,
  type ThemeDensity,
  type ThemeMode,
  type ThemeVisualStyle,
} from '@platform/theme-config';
import {
  PFAppBar,
  PFButton,
  PFCard,
  PFCardContent,
  PFCardHeader,
  PFDialog,
  PFSelect,
  PFTable,
  PFTextArea,
  PFTextField,
  PFToolbar,
  PFTypography,
  PFStack,
  type PlatformTheme,
  usePlatformTheme,
} from '@platform/ui-kit';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import styles from './ThemeStudio.module.scss';

const FONT_OPTIONS = [
  { value: '"Plus Jakarta Sans", "Avenir Next", "Segoe UI", Arial, sans-serif', label: 'Plus Jakarta Sans' },
  { value: '"IBM Plex Sans", "Segoe UI", Arial, sans-serif', label: 'IBM Plex Sans' },
  { value: '"Source Sans 3", "Segoe UI", Arial, sans-serif', label: 'Source Sans 3' },
  { value: '"Manrope", "Segoe UI", Arial, sans-serif', label: 'Manrope' },
  { value: '"Work Sans", "Segoe UI", Arial, sans-serif', label: 'Work Sans' },
];

const MODE_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const DENSITY_OPTIONS: Array<{ value: ThemeDensity; label: string }> = [
  { value: 'cozy', label: 'Cozy' },
  { value: 'compact', label: 'Compact' },
];

const VISUAL_OPTIONS: Array<{ value: ThemeVisualStyle; label: string }> = [
  { value: 'flat', label: 'Flat' },
  { value: 'layered', label: 'Layered' },
  { value: '3d', label: '3D' },
];

const PREVIEW_ROWS = [
  { workspace: 'Orders', owner: 'Operations', status: 'Active' },
  { workspace: 'Billing', owner: 'Finance', status: 'Draft' },
  { workspace: 'Messaging', owner: 'Support', status: 'Review' },
];

export function ThemeStudio() {
  const { toast } = useToast();
  const { theme, setTheme } = usePlatformTheme();

  const [draft, setDraft] = useState<ThemeConfig>(() => createDefaultThemeConfig());
  const [importValue, setImportValue] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const initializedRef = useRef(false);
  const repositoryRef = useRef<ThemeConfigRepository | null>(null);

  useEffect(() => {
    if (initializedRef.current || typeof window === 'undefined') return;
    initializedRef.current = true;

    const repository = createLocalStorageThemeConfigRepository(window.localStorage);
    repositoryRef.current = repository;

    void repository.load().then((stored) => {
      const seed = stored ?? fromRuntimeTheme(toThemeRuntime(theme));
      applyThemeConfig(seed, setTheme, setDraft);
      setImportValue(exportThemeConfig(seed));
      syncFavicon(seed.brand.faviconUrl);
    });
  }, [setTheme, theme]);

  useEffect(() => {
    syncFavicon(draft.brand.faviconUrl);
  }, [draft.brand.faviconUrl]);

  const isImportDirty = useMemo(() => importValue.trim().length > 0, [importValue]);

  const updateDraft = (updater: (current: ThemeConfig) => ThemeConfig): void => {
    setDraft((current) => {
      const next = updater(cloneThemeConfig(current));
      applyThemeConfig(next, setTheme);
      return next;
    });
  };

  const onLogoUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    updateDraft((current) => ({
      ...current,
      brand: {
        ...current.brand,
        logoUrl: dataUrl,
      },
    }));
  };

  const onFaviconUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    updateDraft((current) => ({
      ...current,
      brand: {
        ...current.brand,
        faviconUrl: dataUrl,
      },
    }));
  };

  const saveTheme = async (): Promise<void> => {
    if (!repositoryRef.current) return;
    setBusy(true);
    try {
      const result = await repositoryRef.current.save(draft);
      if (!result.valid || !result.value) {
        toast({
          variant: 'error',
          title: 'Theme validation failed',
          description: result.errors.join(' '),
        });
        return;
      }

      applyThemeConfig(result.value, setTheme, setDraft);
      setImportValue(exportThemeConfig(result.value));
      toast({ variant: 'success', title: 'Tenant theme saved locally' });
    } finally {
      setBusy(false);
    }
  };

  const exportTheme = async (): Promise<void> => {
    try {
      const payload = exportThemeConfig(draft);
      setImportValue(payload);
      await navigator.clipboard.writeText(payload);
      toast({ variant: 'success', title: 'Theme JSON copied to clipboard' });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Export failed',
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const importTheme = (): void => {
    const result = importThemeConfig(importValue);
    if (!result.valid || !result.value) {
      toast({
        variant: 'error',
        title: 'Import failed',
        description: result.errors.join(' '),
      });
      return;
    }

    applyThemeConfig(result.value, setTheme, setDraft);
    toast({ variant: 'success', title: 'Theme JSON imported' });
  };

  return (
    <section className={styles.root} data-testid="theme-studio-page">
      <header className={cn(styles.hero, 'pf-surface-panel')}>
        <div>
          <PFTypography variant="h3">Theme Studio</PFTypography>
          <PFTypography variant="body2" muted>
            Build a Branding Pack for each tenant with safe, token-driven controls.
          </PFTypography>
        </div>
        <div className={styles.heroActions}>
          <PFButton
            size="sm"
            variant="outline"
            intent="neutral"
            onClick={exportTheme}
            data-testid="theme-studio-export"
          >
            Export theme JSON
          </PFButton>
          <PFButton
            size="sm"
            onClick={saveTheme}
            disabled={busy}
            data-testid="theme-studio-save"
          >
            {busy ? 'Saving...' : 'Save to tenant theme'}
          </PFButton>
        </div>
      </header>

      <div className={styles.shell}>
        <aside className={cn(styles.controlsPane, 'rfScrollbar', 'pf-surface-panel')}>
          <section className={styles.section}>
            <PFTypography variant="h6">Theme mode</PFTypography>
            <div className={styles.fieldRow}>
              <PFSelect
                aria-label="Theme mode"
                value={draft.mode}
                options={MODE_OPTIONS}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    mode: event.target.value as ThemeMode,
                  }))
                }
                data-testid="theme-studio-mode"
              />
              <PFSelect
                aria-label="Density"
                value={draft.density}
                options={DENSITY_OPTIONS}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    density: event.target.value as ThemeDensity,
                  }))
                }
                data-testid="theme-studio-density"
              />
            </div>
            <PFSelect
              aria-label="Visual style"
              value={draft.visual}
              options={VISUAL_OPTIONS}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  visual: event.target.value as ThemeVisualStyle,
                }))
              }
              data-testid="theme-studio-visual"
            />
          </section>

          <section className={styles.section}>
            <PFTypography variant="h6">Brand colors</PFTypography>
            <div className={styles.colorField}>
              <PFTextField
                id="theme-primary"
                label="Primary"
                value={draft.brand.primary}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    brand: { ...current.brand, primary: normalizeHexInput(event.target.value) },
                  }))
                }
                data-testid="theme-studio-primary"
              />
              <input
                className={styles.colorPicker}
                type="color"
                aria-label="Primary color picker"
                value={safeColor(draft.brand.primary)}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    brand: { ...current.brand, primary: event.target.value },
                  }))
                }
              />
            </div>
            <div className={styles.colorField}>
              <PFTextField
                id="theme-secondary"
                label="Secondary"
                value={draft.brand.secondary}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    brand: { ...current.brand, secondary: normalizeHexInput(event.target.value) },
                  }))
                }
                data-testid="theme-studio-secondary"
              />
              <input
                className={styles.colorPicker}
                type="color"
                aria-label="Secondary color picker"
                value={safeColor(draft.brand.secondary)}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    brand: { ...current.brand, secondary: event.target.value },
                  }))
                }
              />
            </div>
          </section>

          <section className={styles.section}>
            <PFTypography variant="h6">Typography and shape</PFTypography>
            <PFSelect
              aria-label="Font family"
              value={draft.brand.fontFamily}
              options={FONT_OPTIONS}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  brand: { ...current.brand, fontFamily: event.target.value },
                }))
              }
              data-testid="theme-studio-font"
            />
            <PFTextField
              id="theme-font-custom"
              label="Custom font stack"
              value={draft.brand.fontFamily}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  brand: { ...current.brand, fontFamily: event.target.value },
                }))
              }
              helperText="Optional override"
            />

            <label htmlFor="theme-radius" className={styles.sliderLabel}>
              Radius scale: <span>{draft.brand.radiusScale.toFixed(2)}</span>
            </label>
            <input
              id="theme-radius"
              className={styles.slider}
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={draft.brand.radiusScale}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  brand: { ...current.brand, radiusScale: Number(event.target.value) },
                }))
              }
              data-testid="theme-studio-radius"
            />
          </section>

          <section className={styles.section}>
            <PFTypography variant="h6">Depth controls</PFTypography>
            <label htmlFor="theme-elevation" className={styles.sliderLabel}>
              Elevation intensity: <span>{draft.brand.elevationIntensity.toFixed(2)}</span>
            </label>
            <input
              id="theme-elevation"
              className={styles.slider}
              type="range"
              min={0.6}
              max={1.8}
              step={0.05}
              value={draft.brand.elevationIntensity}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  brand: { ...current.brand, elevationIntensity: Number(event.target.value) },
                }))
              }
              data-testid="theme-studio-elevation"
            />

            <label htmlFor="theme-noise" className={styles.sliderLabel}>
              Noise amount: <span>{draft.brand.noise.toFixed(3)}</span>
            </label>
            <input
              id="theme-noise"
              className={styles.slider}
              type="range"
              min={0}
              max={0.08}
              step={0.005}
              value={draft.brand.noise}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  brand: { ...current.brand, noise: Number(event.target.value) },
                }))
              }
              data-testid="theme-studio-noise"
            />
          </section>

          <section className={styles.section}>
            <PFTypography variant="h6">Brand assets</PFTypography>
            <div className={styles.uploadGrid}>
              <label className={styles.uploadField}>
                <span>Logo upload</span>
                <input type="file" accept="image/*" onChange={onLogoUpload} data-testid="theme-studio-logo-upload" />
              </label>
              <label className={styles.uploadField}>
                <span>Favicon upload</span>
                <input type="file" accept="image/*" onChange={onFaviconUpload} data-testid="theme-studio-favicon-upload" />
              </label>
            </div>
            {draft.brand.logoUrl ? (
              <img src={draft.brand.logoUrl} alt="Uploaded logo preview" className={styles.logoPreview} />
            ) : null}
          </section>

          <section className={styles.section}>
            <PFTypography variant="h6">Import theme JSON</PFTypography>
            <PFTextArea
              value={importValue}
              onChange={(event) => setImportValue(event.target.value)}
              rows={8}
              aria-label="Theme JSON import"
              data-testid="theme-studio-import-input"
            />
            <div className={styles.importActions}>
              <PFButton
                size="sm"
                variant="outline"
                intent="neutral"
                onClick={() => setImportValue(exportThemeConfig(draft))}
                disabled={!isImportDirty}
              >
                Reset payload
              </PFButton>
              <PFButton size="sm" onClick={importTheme} data-testid="theme-studio-import-apply">
                Import and apply
              </PFButton>
            </div>
          </section>
        </aside>

        <main className={cn(styles.previewPane, 'rf-theme-studio-preview')} data-testid="theme-studio-preview">
          <div className={styles.previewHeader}>
            <div className={styles.previewBrand}>
              {draft.brand.logoUrl ? (
                <img src={draft.brand.logoUrl} alt="Brand logo" className={styles.previewLogo} />
              ) : (
                <div className={styles.previewMark}>RF</div>
              )}
              <div>
                <PFTypography variant="h5">Live Branding Preview</PFTypography>
                <PFTypography variant="body2" muted>
                  Preview reflects light/dark, density, visual style, colors, and radius instantly.
                </PFTypography>
              </div>
            </div>
            <PFButton size="sm" onClick={() => setDialogOpen(true)}>
              Open dialog preview
            </PFButton>
          </div>

          <div className={styles.previewCanvas}>
            <PFAppBar position="static" className={styles.previewAppBar}>
              <PFToolbar className={styles.previewToolbar} align="space-between" wrap>
                <PFTypography variant="h6">Operations Dashboard</PFTypography>
                <PFStack direction="row" gap={8}>
                  <PFButton size="sm" variant="outline" intent="neutral">Export</PFButton>
                  <PFButton size="sm">Create rule</PFButton>
                </PFStack>
              </PFToolbar>
            </PFAppBar>

            <div className={styles.previewGrid}>
              <PFCard>
                <PFCardHeader>
                  <PFTypography variant="h6">Filter controls</PFTypography>
                </PFCardHeader>
                <PFCardContent className={styles.formStack}>
                  <PFTextField id="preview-customer" label="Customer" placeholder="Search by customer" />
                  <PFTextField id="preview-region" label="Region" placeholder="US-East" />
                  <PFButton>Run search</PFButton>
                </PFCardContent>
              </PFCard>

              <PFCard>
                <PFCardHeader>
                  <PFTypography variant="h6">Workspace ownership</PFTypography>
                </PFCardHeader>
                <PFCardContent>
                  <PFTable
                    columns={[
                      { id: 'workspace', header: 'Workspace' },
                      { id: 'owner', header: 'Owner' },
                      { id: 'status', header: 'Status' },
                    ]}
                    rows={PREVIEW_ROWS}
                  />
                </PFCardContent>
              </PFCard>
            </div>
          </div>
        </main>
      </div>

      <PFDialog
        open={dialogOpen}
        title="Dialog surface preview"
        description="Use this sample to validate sticky header/footer and contrast after theme changes."
        onClose={() => setDialogOpen(false)}
        actions={(
          <>
            <PFButton variant="outline" intent="neutral" onClick={() => setDialogOpen(false)}>
              Cancel
            </PFButton>
            <PFButton onClick={() => setDialogOpen(false)}>Confirm</PFButton>
          </>
        )}
      >
        <PFTypography variant="body2">
          This dialog uses the same token pipeline as runtime modals, including density and visual depth.
        </PFTypography>
      </PFDialog>
    </section>
  );
}

function cloneThemeConfig(config: ThemeConfig): ThemeConfig {
  return {
    ...config,
    brand: { ...config.brand },
  };
}

function applyThemeConfig(
  config: ThemeConfig,
  setTheme: (theme: Partial<PlatformTheme>) => void,
  setDraft?: (config: ThemeConfig) => void,
): void {
  setTheme(toRuntimeTheme(config));
  setDraft?.(config);
}

function toThemeRuntime(theme: PlatformTheme) {
  return {
    mode: theme.mode,
    density: theme.density,
    visual: theme.visual,
    brand: {
      logoUrl: theme.brand?.logoUrl,
      faviconUrl: theme.brand?.faviconUrl,
      primary: theme.brand?.primary,
      secondary: theme.brand?.secondary,
      fontFamily: theme.brand?.fontFamily,
      radiusScale: theme.brand?.radiusScale,
      elevationIntensity: theme.brand?.elevationIntensity,
      noise: theme.brand?.noise,
    },
  };
}

function normalizeHexInput(value: string): string {
  return value.trim();
}

function safeColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#2f6af5';
}

function syncFavicon(dataUrl?: string): void {
  if (typeof document === 'undefined') return;
  if (!dataUrl) return;

  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = dataUrl;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unable to read file as data URL.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed.'));
    reader.readAsDataURL(file);
  });
}
