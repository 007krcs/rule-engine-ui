import IntlMessageFormat from 'intl-messageformat';

export type LocaleDirection = 'ltr' | 'rtl';

export interface TranslationBundle {
  locale: string;
  namespace: string;
  messages: Record<string, string>;
}

export interface BundleLoader {
  load(params: { tenantId?: string; locale: string; namespace: string }): Promise<TranslationBundle | null>;
}

export interface DynamicImportBundleLoaderOptions {
  importer: (params: { locale: string; namespace: string; tenantId?: string }) => Promise<
    | TranslationBundle
    | { messages: Record<string, string> }
    | { default: TranslationBundle | { messages: Record<string, string> } }
  >;
}

export interface BundleCache {
  get(key: string): TranslationBundle | undefined;
  set(key: string, value: TranslationBundle, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
}

export interface I18nProvider {
  locale: string;
  direction: LocaleDirection;
  themeTokens: Record<string, string | number>;
  t(key: string, params?: Record<string, unknown>, options?: TranslateOptions): string;
  has(key: string, options?: TranslateOptions): boolean;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
  formatDate(value: Date, options?: Intl.DateTimeFormatOptions): string;
}

export interface TranslateOptions {
  namespace?: string;
  defaultText?: string;
}

export interface CreateI18nProviderOptions {
  locale: string;
  tenantId?: string;
  namespaces: string[];
  platformBundles?: TranslationBundle[];
  tenantBundleLoader?: BundleLoader;
  cache?: BundleCache;
  fallbackLocale?: string;
  fallbackLocales?: string[];
  mode?: 'dev' | 'prod';
  machineTranslation?: MachineTranslationOptions;
  localeThemes?: LocaleThemeConfig;
}

export interface MachineTranslationProvider {
  translate(params: { text: string; fromLocale: string; toLocale: string; namespace: string; key: string }): Promise<string>;
}

export interface MachineTranslationOptions {
  enabled?: boolean;
  envs?: Array<'development' | 'staging' | 'test' | 'production'>;
  provider: MachineTranslationProvider;
}

export interface LocaleThemeConfig {
  base?: Record<string, string | number>;
  byLocale?: Record<string, Record<string, string | number>>;
  fallbackLocale?: string;
}

export function resolveLocalizedTheme(
  locale: string,
  config?: LocaleThemeConfig,
): Record<string, string | number> {
  return resolveLocaleThemeTokens(config, locale);
}

export const RTL_LOCALES = ['ar', 'he', 'fa', 'ur'];

export const PLATFORM_BUNDLES: TranslationBundle[] = [
  {
    locale: 'en',
    namespace: 'runtime',
    messages: {
      'filters.customerName.label': 'Customer name',
      'filters.customerName.placeholder': 'Search by name',
      'filters.customerName.helper': 'Use at least 2 characters',
      'filters.customerName.aria': 'Customer name filter',
      'filters.orderTotal.label': 'Order total',
      'filters.orderTotal.placeholder': 'Enter order total',
      'filters.orderTotal.helper': 'Use a number',
      'filters.orderTotal.aria': 'Order total filter',
      'orders.table.label': 'Orders',
      'orders.table.aria': 'Orders table',
      'orders.table.columns.orderId': 'Order',
      'orders.table.columns.customer': 'Customer',
      'orders.table.columns.total': 'Total',
      'revenue.chart.label': 'Revenue trend',
      'revenue.chart.aria': 'Revenue chart',
      'customViz.label': 'Custom visualization',
      'customViz.aria': 'Custom visualization',
      'company.orderTotal.label': 'Order total',
      'company.orderTotal.aria': 'Order total input',
      'company.loanAmount.label': 'Loan amount',
      'company.loanAmount.aria': 'Loan amount input',
      'company.riskBadge.label': 'Risk',
      'company.riskBadge.aria': 'Risk level badge',
    },
  },
  {
    locale: 'de',
    namespace: 'runtime',
    messages: {
      'filters.customerName.label': 'Kundenname',
      'filters.customerName.placeholder': 'Nach Namen suchen',
      'filters.customerName.helper': 'Mindestens 2 Zeichen verwenden',
      'filters.customerName.aria': 'Filter Kundenname',
      'filters.orderTotal.label': 'Bestellsumme',
      'filters.orderTotal.placeholder': 'Bestellsumme eingeben',
      'filters.orderTotal.helper': 'Zahl eingeben',
      'filters.orderTotal.aria': 'Filter Bestellsumme',
      'orders.table.label': 'Bestellungen',
      'orders.table.aria': 'Bestellungstabelle',
      'orders.table.columns.orderId': 'Bestellung',
      'orders.table.columns.customer': 'Kunde',
      'orders.table.columns.total': 'Summe',
      'revenue.chart.label': 'Umsatztrend',
      'revenue.chart.aria': 'Umsatzdiagramm',
      'customViz.label': 'Benutzerdefinierte Visualisierung',
      'customViz.aria': 'Benutzerdefinierte Visualisierung',
    },
  },
  {
    locale: 'fr',
    namespace: 'runtime',
    messages: {
      'filters.customerName.label': 'Nom du client',
      'filters.customerName.placeholder': 'Rechercher par nom',
      'filters.customerName.helper': 'Utilisez au moins 2 caractères',
      'filters.customerName.aria': 'Filtre nom du client',
      'filters.orderTotal.label': 'Total de commande',
      'filters.orderTotal.placeholder': 'Saisir le total',
      'filters.orderTotal.helper': 'Utilisez un nombre',
      'filters.orderTotal.aria': 'Filtre total de commande',
      'orders.table.label': 'Commandes',
      'orders.table.aria': 'Tableau des commandes',
      'orders.table.columns.orderId': 'Commande',
      'orders.table.columns.customer': 'Client',
      'orders.table.columns.total': 'Total',
      'revenue.chart.label': 'Tendance des revenus',
      'revenue.chart.aria': 'Graphique des revenus',
      'customViz.label': 'Visualisation personnalisée',
      'customViz.aria': 'Visualisation personnalisée',
    },
  },
  {
    locale: 'hi',
    namespace: 'runtime',
    messages: {
      'filters.customerName.label': 'ग्राहक नाम',
      'filters.customerName.placeholder': 'नाम से खोजें',
      'filters.customerName.helper': 'कम से कम 2 अक्षर उपयोग करें',
      'filters.customerName.aria': 'ग्राहक नाम फ़िल्टर',
      'filters.orderTotal.label': 'ऑर्डर कुल',
      'filters.orderTotal.placeholder': 'ऑर्डर कुल दर्ज करें',
      'filters.orderTotal.helper': 'एक संख्या उपयोग करें',
      'filters.orderTotal.aria': 'ऑर्डर कुल फ़िल्टर',
      'orders.table.label': 'ऑर्डर',
      'orders.table.aria': 'ऑर्डर तालिका',
      'orders.table.columns.orderId': 'ऑर्डर',
      'orders.table.columns.customer': 'ग्राहक',
      'orders.table.columns.total': 'कुल',
      'revenue.chart.label': 'राजस्व प्रवृत्ति',
      'revenue.chart.aria': 'राजस्व चार्ट',
      'customViz.label': 'कस्टम विज़ुअलाइज़ेशन',
      'customViz.aria': 'कस्टम विज़ुअलाइज़ेशन',
    },
  },
];

export const EXAMPLE_TENANT_BUNDLES: TranslationBundle[] = [
  {
    locale: 'ar',
    namespace: 'runtime',
    messages: {
      'filters.customerName.label': 'اسم العميل',
      'filters.customerName.placeholder': 'ابحث بالاسم',
      'filters.customerName.helper': 'استخدم حرفين على الأقل',
      'filters.customerName.aria': 'مرشح اسم العميل',
      'filters.orderTotal.label': 'إجمالي الطلب',
      'filters.orderTotal.placeholder': 'أدخل إجمالي الطلب',
      'filters.orderTotal.helper': 'استخدم رقمًا',
      'filters.orderTotal.aria': 'مرشح إجمالي الطلب',
      'orders.table.label': 'الطلبات',
      'orders.table.aria': 'جدول الطلبات',
      'orders.table.columns.orderId': 'طلب',
      'orders.table.columns.customer': 'عميل',
      'orders.table.columns.total': 'الإجمالي',
      'revenue.chart.label': 'اتجاه الإيرادات',
      'revenue.chart.aria': 'مخطط الإيرادات',
      'customViz.label': 'تصور مخصص',
      'customViz.aria': 'تصور مخصص',
    },
  },
];

export async function createI18nProvider(options: CreateI18nProviderOptions): Promise<I18nProvider> {
  const platformBundles = options.platformBundles ?? PLATFORM_BUNDLES;
  const resolvedBundles: TranslationBundle[] = [...platformBundles];
  const localeChain = buildLocaleFallbackChain(
    options.locale,
    options.fallbackLocale,
    options.fallbackLocales,
  );

  if (options.tenantBundleLoader) {
    const cache = options.cache ?? createMemoryCache();
    for (const namespace of options.namespaces) {
      for (const locale of localeChain) {
        const cacheKey = buildCacheKey(options.tenantId, locale, namespace);
        let bundle = cache.get(cacheKey);
        if (!bundle) {
          const loaded = await options.tenantBundleLoader.load({
            tenantId: options.tenantId,
            locale,
            namespace,
          });
          if (loaded) {
            cache.set(cacheKey, loaded);
            bundle = loaded;
          }
        }
        if (bundle) resolvedBundles.push(bundle);
      }
    }
  }

  const machineTranslationEnabled = shouldEnableMachineTranslation(options.machineTranslation);
  if (machineTranslationEnabled && options.machineTranslation) {
    await prefillMissingMessagesWithMachineTranslation(
      resolvedBundles,
      options.namespaces,
      localeChain,
      options.machineTranslation.provider,
    );
  }

  return createProviderFromBundles({
    locale: options.locale,
    bundles: resolvedBundles,
    fallbackLocale: options.fallbackLocale,
    fallbackLocales: options.fallbackLocales,
    mode: options.mode ?? 'prod',
    localeThemes: options.localeThemes,
  });
}

export function createProviderFromBundles(options: {
  locale: string;
  bundles: TranslationBundle[];
  fallbackLocale?: string;
  fallbackLocales?: string[];
  mode?: 'dev' | 'prod';
  localeThemes?: LocaleThemeConfig;
}): I18nProvider {
  const mode = options.mode ?? 'prod';
  const bundleIndex = indexBundles(options.bundles);
  const localeChain = buildLocaleFallbackChain(options.locale, options.fallbackLocale, options.fallbackLocales);
  const themeTokens = resolveLocaleThemeTokens(options.localeThemes, options.locale);

  return {
    locale: options.locale,
    direction: resolveDirection(options.locale),
    themeTokens,
    t: (key, params, translateOptions) => {
      const { namespace, entryKey } = resolveKey(key, translateOptions);
      const message = resolveMessage(bundleIndex, localeChain, namespace, entryKey);
      if (!message) {
        if (mode === 'dev') return key;
        return translateOptions?.defaultText ?? '';
      }
      return formatMessage(message, options.locale, params);
    },
    has: (key, translateOptions) => {
      const { namespace, entryKey } = resolveKey(key, translateOptions);
      return !!resolveMessage(bundleIndex, localeChain, namespace, entryKey);
    },
    formatNumber: (value, formatOptions) =>
      new Intl.NumberFormat(options.locale, formatOptions).format(value),
    formatDate: (value, formatOptions) =>
      new Intl.DateTimeFormat(options.locale, formatOptions).format(value),
  };
}

export function createFallbackI18nProvider(locale = 'en'): I18nProvider {
  return {
    locale,
    direction: resolveDirection(locale),
    themeTokens: {},
    t: (key, _params, options) => options?.defaultText ?? key,
    has: () => true,
    formatNumber: (value, formatOptions) => new Intl.NumberFormat(locale, formatOptions).format(value),
    formatDate: (value, formatOptions) => new Intl.DateTimeFormat(locale, formatOptions).format(value),
  };
}

export function createMemoryCache(defaultTtlMs = 5 * 60 * 1000): BundleCache {
  const store = new Map<string, { value: TranslationBundle; expiresAt: number | null }>();
  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value, ttlMs = defaultTtlMs) {
      store.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : null });
    },
    delete(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

export function createMockTenantLoader(bundles: TranslationBundle[]): BundleLoader {
  return {
    async load(params) {
      return (
        bundles.find(
          (bundle) =>
            bundle.locale === params.locale &&
            bundle.namespace === params.namespace,
        ) ?? null
      );
    },
  };
}

export function createHttpBundleLoader(options: {
  baseUrl: string;
  fetchFn?: typeof fetch;
}): BundleLoader {
  const fetcher = options.fetchFn ?? fetch;
  return {
    async load(params) {
      if (!params.tenantId) return null;
      const url = `${options.baseUrl}/${params.tenantId}/${params.locale}/${params.namespace}.json`;
      const response = await fetcher(url);
      if (!response.ok) return null;
      const messages = (await response.json()) as Record<string, string>;
      return { locale: params.locale, namespace: params.namespace, messages };
    },
  };
}

export function createDynamicImportBundleLoader(
  options: DynamicImportBundleLoaderOptions,
): BundleLoader {
  return {
    async load(params) {
      try {
        const loaded = await options.importer(params);
        const normalized = normalizeDynamicBundlePayload(loaded);
        if (!normalized) return null;
        return {
          locale: params.locale,
          namespace: params.namespace,
          messages: normalized.messages,
        };
      } catch {
        return null;
      }
    },
  };
}

export function createDevelopmentMachineTranslator(
  translateFn?: (params: { text: string; fromLocale: string; toLocale: string }) => Promise<string>,
): MachineTranslationProvider {
  return {
    async translate(params) {
      if (translateFn) return translateFn(params);
      return `[MT ${params.toLocale}] ${params.text}`;
    },
  };
}

export interface LocaleResolverInput {
  tenantLocale?: string | null;
  userLocale?: string | null;
  fallbackLocale?: string;
  supportedLocales?: string[];
}

export function resolveLocale(input: LocaleResolverInput): string {
  const fallbackLocale = normalizeLocale(input.fallbackLocale) ?? 'en';
  const supported = (input.supportedLocales ?? []).map((locale) => normalizeLocale(locale)).filter(Boolean) as string[];

  const preferred = [
    normalizeLocale(input.userLocale),
    normalizeLocale(input.tenantLocale),
    fallbackLocale,
  ].filter(Boolean) as string[];

  if (supported.length === 0) {
    return preferred[0] ?? fallbackLocale;
  }

  for (const candidate of preferred) {
    if (supported.includes(candidate)) return candidate;
    const language = candidate.split('-')[0];
    if (language) {
      const languageMatch = supported.find((locale) => locale === language || locale.startsWith(`${language}-`));
      if (languageMatch) return languageMatch;
    }
  }
  return fallbackLocale;
}

export function listBundleLocales(bundles: TranslationBundle[]): string[] {
  const locales = bundles
    .map((bundle) => normalizeLocale(bundle.locale))
    .filter((locale): locale is string => typeof locale === 'string');
  return Array.from(new Set(locales)).sort((a, b) => a.localeCompare(b));
}

export function upsertBundleMessage(
  bundles: TranslationBundle[],
  payload: { locale: string; namespace: string; key: string; value: string },
): TranslationBundle[] {
  const locale = normalizeLocale(payload.locale) ?? payload.locale;
  const namespace = payload.namespace.trim() || 'runtime';
  const key = payload.key.trim();
  const value = payload.value;
  if (!key) return bundles;

  const next = bundles.map((bundle) => ({
    ...bundle,
    messages: { ...bundle.messages },
  }));

  const existing = next.find((bundle) => bundle.locale === locale && bundle.namespace === namespace);
  if (existing) {
    existing.messages[key] = value;
    return next;
  }

  next.push({
    locale,
    namespace,
    messages: {
      [key]: value,
    },
  });
  return next;
}

function normalizeLocale(locale: string | null | undefined): string | null {
  if (!locale) return null;
  const trimmed = locale.trim();
  if (!trimmed) return null;
  return trimmed;
}

function buildCacheKey(tenantId: string | undefined, locale: string, namespace: string): string {
  return `${tenantId ?? 'platform'}:${locale}:${namespace}`;
}

function resolveDirection(locale: string): LocaleDirection {
  const normalized = locale.toLowerCase();
  return RTL_LOCALES.some((rtl) => normalized.startsWith(rtl)) ? 'rtl' : 'ltr';
}

type BundleIndex = Map<string, Map<string, TranslationBundle[]>>;

function indexBundles(bundles: TranslationBundle[]): BundleIndex {
  const index: BundleIndex = new Map();
  for (const bundle of bundles) {
    const byLocale = index.get(bundle.locale) ?? new Map<string, TranslationBundle[]>();
    const byNamespace = byLocale.get(bundle.namespace) ?? [];
    byNamespace.push(bundle);
    byLocale.set(bundle.namespace, byNamespace);
    index.set(bundle.locale, byLocale);
  }
  return index;
}

function resolveKey(key: string, options?: TranslateOptions): { namespace: string; entryKey: string } {
  if (options?.namespace) {
    return { namespace: options.namespace, entryKey: key };
  }
  if (key.includes(':')) {
    const [namespace, entryKey] = key.split(':', 2);
    return { namespace: namespace || 'runtime', entryKey: entryKey ?? key };
  }
  if (key.includes('.')) {
    const [namespace, ...rest] = key.split('.');
    const entryKey = rest.length > 0 ? rest.join('.') : key;
    return { namespace: namespace || 'runtime', entryKey };
  }
  return { namespace: 'runtime', entryKey: key };
}

function resolveMessage(
  index: BundleIndex,
  localeChain: string[],
  namespace: string,
  entryKey: string,
): string | undefined {
  for (const locale of localeChain) {
    const local = lookupMessage(index, locale, namespace, entryKey);
    if (local !== undefined) return local;
  }
  return undefined;
}

function lookupMessage(index: BundleIndex, locale: string, namespace: string, entryKey: string): string | undefined {
  const byLocale = index.get(locale);
  if (!byLocale) return undefined;
  const bundles = byLocale.get(namespace);
  if (!bundles) return undefined;
  for (const bundle of bundles) {
    const message = bundle.messages[entryKey];
    if (message !== undefined) return message;
  }
  return undefined;
}

function buildLocaleFallbackChain(
  locale: string,
  fallbackLocale?: string,
  fallbackLocales?: string[],
): string[] {
  const chain: string[] = [];
  const pushLocale = (value: string | undefined) => {
    const normalized = normalizeLocale(value);
    if (!normalized || chain.includes(normalized)) return;
    chain.push(normalized);
  };

  pushLocale(locale);
  const language = normalizeLocale(locale)?.split('-')[0];
  if (language) pushLocale(language);
  for (const fallback of fallbackLocales ?? []) pushLocale(fallback);
  pushLocale(fallbackLocale);
  if (chain.length === 0) pushLocale('en');
  return chain;
}

function resolveLocaleThemeTokens(config: LocaleThemeConfig | undefined, locale: string): Record<string, string | number> {
  if (!config) return {};
  const base = { ...(config.base ?? {}) };
  const localeChain = buildLocaleFallbackChain(locale, config.fallbackLocale, []);
  for (const candidate of localeChain) {
    const overrides = config.byLocale?.[candidate];
    if (!overrides) continue;
    Object.assign(base, overrides);
  }
  return base;
}

async function prefillMissingMessagesWithMachineTranslation(
  bundles: TranslationBundle[],
  namespaces: string[],
  localeChain: string[],
  provider: MachineTranslationProvider,
): Promise<void> {
  if (localeChain.length === 0) return;
  const targetLocale = localeChain[0] ?? 'en';
  const sourceLocale = localeChain.find((locale) => locale !== targetLocale) ?? 'en';

  for (const namespace of namespaces) {
    const targetBundle = ensureBundle(bundles, targetLocale, namespace);
    const sourceBundle = findBundle(bundles, sourceLocale, namespace) ?? findBundle(bundles, 'en', namespace);
    if (!sourceBundle) continue;
    for (const [key, text] of Object.entries(sourceBundle.messages)) {
      if (targetBundle.messages[key] !== undefined) continue;
      targetBundle.messages[key] = await provider.translate({
        text,
        fromLocale: sourceBundle.locale,
        toLocale: targetLocale,
        namespace,
        key,
      });
    }
  }
}

function ensureBundle(bundles: TranslationBundle[], locale: string, namespace: string): TranslationBundle {
  const existing = findBundle(bundles, locale, namespace);
  if (existing) return existing;
  const created: TranslationBundle = { locale, namespace, messages: {} };
  bundles.push(created);
  return created;
}

function findBundle(bundles: TranslationBundle[], locale: string, namespace: string): TranslationBundle | undefined {
  return bundles.find((bundle) => bundle.locale === locale && bundle.namespace === namespace);
}

function readProcessEnv(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

function shouldEnableMachineTranslation(options: MachineTranslationOptions | undefined): boolean {
  if (!options?.enabled) return false;
  const rawEnv = readProcessEnv('RULEFLOW_ENV') ?? '';
  const normalizedEnv = rawEnv.trim().toLowerCase();
  const currentEnv = (
    normalizedEnv === 'production' ||
    normalizedEnv === 'staging' ||
    normalizedEnv === 'test' ||
    normalizedEnv === 'development'
      ? normalizedEnv
      : (readProcessEnv('NODE_ENV') ?? 'development')
  ) as 'development' | 'staging' | 'test' | 'production';
  const allow = options.envs ?? ['development', 'staging'];
  return allow.includes(currentEnv);
}

function normalizeDynamicBundlePayload(
  loaded:
    | TranslationBundle
    | { messages: Record<string, string> }
    | { default: TranslationBundle | { messages: Record<string, string> } },
): TranslationBundle | { messages: Record<string, string> } | null {
  if (!loaded || typeof loaded !== 'object') return null;
  if ('default' in loaded && loaded.default && typeof loaded.default === 'object') {
    return normalizeDynamicBundlePayload(loaded.default as TranslationBundle | { messages: Record<string, string> });
  }
  if ('messages' in loaded && loaded.messages && typeof loaded.messages === 'object') {
    return loaded as TranslationBundle | { messages: Record<string, string> };
  }
  return null;
}

const formatterCache = new Map<string, IntlMessageFormat>();

function formatMessage(message: string, locale: string, params?: Record<string, unknown>): string {
  if (!params) return message;
  const cacheKey = `${locale}::${message}`;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new IntlMessageFormat(message, locale);
    formatterCache.set(cacheKey, formatter);
  }
  const result = formatter.format(params);
  return typeof result === 'string' ? result : String(result);
}
