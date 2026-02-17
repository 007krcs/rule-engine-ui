'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { builtinComponentDefinitions, enrichComponentDefinition, type ComponentDefinition, type JsonSchema } from '@platform/component-registry';
import { PFButton, PFSelect, PFTextField, PFTypography, usePlatformTheme } from '@platform/ui-kit';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { UiKitPropsPanel } from './UiKitPropsPanel';
import { UiKitPreview } from './UiKitPreview';
import { UiKitSidebar, type UiKitSidebarSection } from './UiKitSidebar';
import { UiKitTabs, type UiKitTabId } from './UiKitTabs';
import styles from './UiKitExplorer.module.scss';

const CATEGORIES = [
  'Inputs',
  'Data Display',
  'Feedback',
  'Surfaces',
  'Navigation',
  'Layout',
  'Utils',
] as const;

const FONT_OPTIONS = [
  { value: '"Plus Jakarta Sans", "Avenir Next", "Segoe UI", Arial, sans-serif', label: 'Plus Jakarta Sans' },
  { value: '"Inter", "Segoe UI", Arial, sans-serif', label: 'Inter' },
  { value: '"IBM Plex Sans", "Segoe UI", Arial, sans-serif', label: 'IBM Plex Sans' },
  { value: '"Source Sans 3", "Segoe UI", Arial, sans-serif', label: 'Source Sans 3' },
  { value: '"Manrope", "Segoe UI", Arial, sans-serif', label: 'Manrope' },
];
const DEFAULT_FONT_FAMILY = '"Plus Jakarta Sans", "Avenir Next", "Segoe UI", Arial, sans-serif';

const TABS: Array<{ id: UiKitTabId; label: string }> = [
  { id: 'preview', label: 'Preview' },
  { id: 'props', label: 'Props' },
  { id: 'code', label: 'Code' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'accessibility', label: 'Accessibility' },
];

export function UiKitExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { theme, setMode, setDensity, setBrand } = usePlatformTheme();

  const [tab, setTab] = useState<UiKitTabId>('preview');
  const [query, setQuery] = useState('');
  const [propValues, setPropValues] = useState<Record<string, unknown>>({});
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({});

  const [brandPrimaryInput, setBrandPrimaryInput] = useState(theme.brand?.primary ?? '#2f6af5');
  const [radiusScaleInput, setRadiusScaleInput] = useState(
    String(Number.isFinite(theme.brand?.radiusScale) ? theme.brand?.radiusScale : 1),
  );
  const [fontFamily, setFontFamily] = useState(theme.brand?.fontFamily ?? DEFAULT_FONT_FAMILY);

  const catalog = useMemo(
    () =>
      builtinComponentDefinitions()
        .map(enrichComponentDefinition)
        .filter((item) => item.adapterHint.startsWith('platform.'))
        .filter((item) => CATEGORIES.includes(item.category as (typeof CATEGORIES)[number]))
        .sort((a, b) => {
          const categoryOrder = CATEGORIES.indexOf(a.category as (typeof CATEGORIES)[number]) - CATEGORIES.indexOf(b.category as (typeof CATEGORIES)[number]);
          if (categoryOrder !== 0) return categoryOrder;
          return a.displayName.localeCompare(b.displayName);
        }),
    [],
  );

  const filteredCatalog = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter((item) =>
      [item.displayName, item.adapterHint, item.description]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [catalog, query]);

  const selectedHint = searchParams.get('c');
  const selected = useMemo<ComponentDefinition | null>(() => {
    const byHint = selectedHint ? catalog.find((item) => item.adapterHint === selectedHint) : null;
    if (byHint) return byHint;
    return filteredCatalog.at(0) ?? catalog.at(0) ?? null;
  }, [catalog, filteredCatalog, selectedHint]);

  const sections = useMemo<UiKitSidebarSection[]>(
    () =>
      CATEGORIES.map((category) => ({
        category,
        components: filteredCatalog.filter((item) => item.category === category),
      })).filter((section) => section.components.length > 0),
    [filteredCatalog],
  );

  useEffect(() => {
    if (!selected) return;
    if (selectedHint === selected.adapterHint) return;
    updateSelectedHint(selected.adapterHint, pathname, searchParams, router);
  }, [pathname, router, searchParams, selected, selectedHint]);

  useEffect(() => {
    setPropValues(buildDefaultValues(selected));
  }, [selected?.adapterHint]);

  useEffect(() => {
    setBrandPrimaryInput(theme.brand?.primary ?? '#2f6af5');
    setRadiusScaleInput(String(Number.isFinite(theme.brand?.radiusScale) ? theme.brand?.radiusScale : 1));
    setFontFamily(theme.brand?.fontFamily ?? DEFAULT_FONT_FAMILY);
  }, [theme.brand?.fontFamily, theme.brand?.primary, theme.brand?.radiusScale]);

  useEffect(() => {
    if (!selected) {
      setTokenValues({});
      return;
    }
    const style = getComputedStyle(document.documentElement);
    const nextValues: Record<string, string> = {};
    for (const token of selected.tokensUsed ?? []) {
      const value = style.getPropertyValue(token).trim();
      nextValues[token] = value || '(not set)';
    }
    setTokenValues(nextValues);
  }, [selected?.adapterHint, selected?.tokensUsed, theme.mode, theme.density, theme.brand?.primary, theme.brand?.fontFamily, theme.brand?.radiusScale]);

  const importSnippet = useMemo(() => buildImportSnippet(selected), [selected]);
  const usageSnippet = useMemo(
    () => (selected?.examples?.[0]?.code ? selected.examples[0].code : buildUsageSnippet(selected, propValues)),
    [propValues, selected],
  );

  const applyBrandPrimary = (value: string): void => {
    setBrandPrimaryInput(value);
    if (!isHexColor(value)) return;
    setBrand({ ...(theme.brand ?? {}), primary: value });
  };

  const applyRadiusScale = (value: string): void => {
    setRadiusScaleInput(value);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setBrand({ ...(theme.brand ?? {}), radiusScale: clamp(parsed, 0.5, 2) });
  };

  const applyFontFamily = (value: string): void => {
    setFontFamily(value);
    setBrand({ ...(theme.brand ?? {}), fontFamily: value });
  };

  return (
    <section className={styles.root} data-testid="ui-kit-explorer">
      <header className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <PFTypography variant="h3">Component Explorer</PFTypography>
          <PFTypography variant="body2" muted>
            Explore platform UI primitives with registry-backed docs, tokens, and accessibility notes.
          </PFTypography>
        </div>

        <div className={styles.toolbarControls}>
          <PFSelect
            aria-label="Theme mode"
            value={theme.mode}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(event) => setMode(event.target.value as 'light' | 'dark')}
            data-testid="ui-kit-theme-mode"
          />
          <PFSelect
            aria-label="Density mode"
            value={theme.density}
            options={[
              { value: 'comfortable', label: 'Cozy' },
              { value: 'compact', label: 'Compact' },
            ]}
            onChange={(event) => setDensity(event.target.value as 'comfortable' | 'compact')}
            data-testid="ui-kit-density-mode"
          />
          <PFTextField
            id="ui-kit-brand-primary"
            label="Brand Primary"
            value={brandPrimaryInput}
            onChange={(event) => applyBrandPrimary(event.target.value)}
            helperText={isHexColor(brandPrimaryInput) ? 'Valid hex color' : 'Use #RRGGBB'}
            error={!isHexColor(brandPrimaryInput)}
            data-testid="ui-kit-brand-primary"
          />
          <PFTextField
            id="ui-kit-radius-scale"
            label="Radius Scale"
            type="number"
            min={0.5}
            max={2}
            step={0.1}
            value={radiusScaleInput}
            onChange={(event) => applyRadiusScale(event.target.value)}
            helperText="0.5 - 2.0"
            data-testid="ui-kit-radius-scale"
          />
          <PFSelect
            aria-label="Font family"
            value={fontFamily}
            options={FONT_OPTIONS}
            onChange={(event) => applyFontFamily(event.target.value)}
            data-testid="ui-kit-font-family"
          />
        </div>
      </header>

      <div className={styles.shell}>
        <UiKitSidebar
          sections={sections}
          selectedHint={selected?.adapterHint ?? null}
          query={query}
          onQueryChange={setQuery}
          onSelect={(adapterHint) => updateSelectedHint(adapterHint, pathname, searchParams, router)}
        />

        <main className={cn(styles.mainPane, 'rfScrollbar')} data-testid="ui-kit-main">
          {selected ? (
            <>
              <header className={styles.componentHeader}>
                <div className={styles.componentHeaderText}>
                  <PFTypography variant="h4">PF{selected.displayName}</PFTypography>
                  <PFTypography variant="body2" muted>
                    {selected.description}
                  </PFTypography>
                </div>
                <div className={styles.componentHeaderActions}>
                  <PFButton
                    size="sm"
                    variant="outline"
                    intent="neutral"
                    onClick={() => copyText(importSnippet, 'import', toast)}
                  >
                    Copy import
                  </PFButton>
                  <PFButton
                    size="sm"
                    variant="outline"
                    intent="neutral"
                    onClick={() => copyText(usageSnippet, 'usage', toast)}
                  >
                    Copy usage
                  </PFButton>
                </div>
              </header>

              <UiKitTabs tabs={TABS} activeTab={tab} onChange={setTab} />

              <section className={styles.tabBody}>
                {tab === 'preview' ? <UiKitPreview component={selected} values={propValues} /> : null}
                {tab === 'props' ? <PropsReference component={selected} /> : null}
                {tab === 'code' ? (
                  <CodePanel
                    importSnippet={importSnippet}
                    usageSnippet={usageSnippet}
                    onCopyImport={() => copyText(importSnippet, 'import', toast)}
                    onCopyUsage={() => copyText(usageSnippet, 'usage', toast)}
                  />
                ) : null}
                {tab === 'tokens' ? <TokenPanel tokenValues={tokenValues} /> : null}
                {tab === 'accessibility' ? <AccessibilityPanel component={selected} /> : null}
              </section>
            </>
          ) : (
            <div className={styles.emptyState}>
              <PFTypography variant="h5">No components found</PFTypography>
              <PFTypography variant="body2" muted>
                Update your search query to see available components.
              </PFTypography>
            </div>
          )}
        </main>

        <UiKitPropsPanel
          component={selected}
          values={propValues}
          onChange={(name, value) => setPropValues((current) => ({ ...current, [name]: value }))}
          onReset={() => setPropValues(buildDefaultValues(selected))}
        />
      </div>
    </section>
  );
}

function PropsReference({ component }: { component: ComponentDefinition }) {
  const properties = readProperties(component.propsSchema);
  return (
    <div className={styles.referenceGrid}>
      {properties.length === 0 ? (
        <p className={styles.referenceEmpty}>No documented props for this component.</p>
      ) : (
        properties.map(([name, schema]) => (
          <article key={name} className={styles.referenceCard}>
            <p className={styles.referenceName}>{name}</p>
            <p className={styles.referenceType}>type: {schema.type ?? 'unknown'}</p>
            {schema.description ? <p className={styles.referenceDescription}>{schema.description}</p> : null}
            {schema.type === 'string' && Array.isArray(schema.enum) ? (
              <p className={styles.referenceEnum}>allowed: {schema.enum.join(', ')}</p>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}

function CodePanel({
  importSnippet,
  usageSnippet,
  onCopyImport,
  onCopyUsage,
}: {
  importSnippet: string;
  usageSnippet: string;
  onCopyImport: () => void;
  onCopyUsage: () => void;
}) {
  return (
    <div className={styles.codeGrid}>
      <article className={styles.codeBlock}>
        <div className={styles.codeHeader}>
          <p>Import</p>
          <PFButton size="sm" variant="ghost" intent="neutral" onClick={onCopyImport}>
            Copy
          </PFButton>
        </div>
        <pre><code>{importSnippet}</code></pre>
      </article>
      <article className={styles.codeBlock}>
        <div className={styles.codeHeader}>
          <p>Usage</p>
          <PFButton size="sm" variant="ghost" intent="neutral" onClick={onCopyUsage}>
            Copy
          </PFButton>
        </div>
        <pre><code>{usageSnippet}</code></pre>
      </article>
    </div>
  );
}

function TokenPanel({ tokenValues }: { tokenValues: Record<string, string> }) {
  const entries = Object.entries(tokenValues);
  return (
    <div className={styles.tokenGrid}>
      {entries.length === 0 ? (
        <p className={styles.referenceEmpty}>No token metadata registered for this component.</p>
      ) : (
        entries.map(([token, value]) => (
          <article key={token} className={styles.tokenCard}>
            <p className={styles.tokenName}>{token}</p>
            <p className={styles.tokenValue}>{value}</p>
          </article>
        ))
      )}
    </div>
  );
}

function AccessibilityPanel({ component }: { component: ComponentDefinition }) {
  const requirements = component.accessibility?.requirements ?? [];
  const notes = component.schemaSupport?.notes ?? [];
  return (
    <div className={styles.a11yGrid}>
      <article className={styles.a11yCard}>
        <h3>Checklist</h3>
        <ul>
          {requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li>Tab order remains predictable.</li>
          <li>Enter/Space activates interactive controls.</li>
          <li>Escape closes overlays when supported.</li>
        </ul>
      </article>
      <article className={styles.a11yCard}>
        <h3>Schema Notes</h3>
        <ul>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
          <li>Use i18n keys for label, helperText, and aria labels in runtime schema.</li>
        </ul>
      </article>
    </div>
  );
}

function updateSelectedHint(
  adapterHint: string,
  pathname: string,
  searchParams: URLSearchParams | ReturnType<typeof useSearchParams>,
  router: ReturnType<typeof useRouter>,
) {
  const next = new URLSearchParams(searchParams.toString());
  next.set('c', adapterHint);
  router.replace(`${pathname}?${next.toString()}`, { scroll: false });
}

function buildDefaultValues(component: ComponentDefinition | null): Record<string, unknown> {
  if (!component) return {};
  const defaults: Record<string, unknown> = { ...(component.defaultProps ?? {}) };
  if (component.propsSchema.type !== 'object' || !component.propsSchema.properties) return defaults;
  for (const [name, schema] of Object.entries(component.propsSchema.properties)) {
    if (defaults[name] !== undefined) continue;
    if (typeof (schema as { default?: unknown }).default !== 'undefined') {
      defaults[name] = (schema as { default?: unknown }).default;
      continue;
    }
    if (schema.type === 'boolean') defaults[name] = false;
    if (schema.type === 'string' && Array.isArray(schema.enum) && schema.enum.length > 0) defaults[name] = schema.enum[0];
  }
  return defaults;
}

function readProperties(schema: JsonSchema): Array<[string, JsonSchema]> {
  if (schema.type !== 'object' || !schema.properties) return [];
  return Object.entries(schema.properties);
}

function buildImportSnippet(component: ComponentDefinition | null): string {
  if (!component) return '';
  const importName = getUiKitImportName(component.adapterHint);
  if (!importName) {
    return `// ${component.adapterHint} is adapter-driven.\n// Register an adapter package to render this component.`;
  }
  return `import { ${importName} } from '@platform/ui-kit';`;
}

function buildUsageSnippet(component: ComponentDefinition | null, values: Record<string, unknown>): string {
  if (!component) return '';
  const importName = getUiKitImportName(component.adapterHint);
  if (!importName) {
    return `// ${component.adapterHint} preview is adapter-driven and not rendered directly from ui-kit.`;
  }
  const propsLines = Object.entries(values)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    .map(([name, value]) => {
      if (typeof value === 'string') return `${name}="${escapeDoubleQuotes(value)}"`;
      if (typeof value === 'number') return `${name}={${value}}`;
      if (value === true) return name;
      return `${name}={false}`;
    });
  if (propsLines.length === 0) return `<${importName} />`;
  return `<${importName}\n  ${propsLines.join('\n  ')}\n/>`;
}

function getUiKitImportName(adapterHint: string): string | null {
  const map: Record<string, string> = {
    'platform.textField': 'PFTextField',
    'platform.numberField': 'PFTextField',
    'platform.select': 'PFSelect',
    'platform.checkbox': 'PFCheckbox',
    'platform.radioGroup': 'PFRadio',
    'platform.switch': 'PFSwitch',
    'platform.slider': 'PFSlider',
    'platform.autocomplete': 'PFAutocomplete',
    'platform.dateField': 'PFDateField',
    'platform.timeField': 'PFTimeField',
    'platform.dateTimeField': 'PFDateTimeField',
    'platform.calendar': 'PFCalendar',
    'platform.clock': 'PFClock',
    'platform.textareaAutosize': 'PFTextArea',
    'platform.inputAdornment': 'PFTextField',
    'platform.avatar': 'PFAvatar',
    'platform.badge': 'PFBadge',
    'platform.chip': 'PFChip',
    'platform.divider': 'PFDivider',
    'platform.table': 'PFTable',
    'platform.tooltip': 'PFTooltip',
    'platform.typography': 'PFTypography',
    'platform.alert': 'PFAlert',
    'platform.snackbar': 'PFSnackbar',
    'platform.dialog': 'PFDialog',
    'platform.progressLinear': 'PFProgressLinear',
    'platform.progressCircular': 'PFProgressCircular',
    'platform.skeleton': 'PFSkeleton',
    'platform.accordion': 'PFAccordion',
    'platform.appBar': 'PFAppBar',
    'platform.toolbar': 'PFToolbar',
    'platform.card': 'PFCard',
    'platform.backdrop': 'PFBackdrop',
    'platform.breadcrumbs': 'PFBreadcrumbs',
    'platform.drawer': 'PFDrawer',
    'platform.menu': 'PFMenu',
    'platform.menuItem': 'PFMenuItem',
    'platform.pagination': 'PFPagination',
    'platform.stepper': 'PFStepper',
    'platform.tabs': 'PFTabs',
    'platform.box': 'PFBox',
    'platform.container': 'PFContainer',
    'platform.grid': 'PFGrid',
    'platform.stack': 'PFStack',
    'platform.popover': 'PFPopover',
  };
  return map[adapterHint] ?? null;
}

async function copyText(
  value: string,
  label: string,
  toast: ReturnType<typeof useToast>['toast'],
): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast({ variant: 'success', title: `Copied ${label}` });
  } catch {
    toast({ variant: 'error', title: `Failed to copy ${label}` });
  }
}

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function escapeDoubleQuotes(value: string): string {
  return value.replaceAll('"', '\\"');
}
