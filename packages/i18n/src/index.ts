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

export interface BundleCache {
  get(key: string): TranslationBundle | undefined;
  set(key: string, value: TranslationBundle, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
}

export interface I18nProvider {
  locale: string;
  direction: LocaleDirection;
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
  mode?: 'dev' | 'prod';
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
      'orders.table.label': 'Orders',
      'orders.table.aria': 'Orders table',
      'orders.table.columns.orderId': 'Order',
      'orders.table.columns.customer': 'Customer',
      'orders.table.columns.total': 'Total',
      'revenue.chart.label': 'Revenue trend',
      'revenue.chart.aria': 'Revenue chart',
      'customViz.label': 'Custom visualization',
      'customViz.aria': 'Custom visualization',
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

  if (options.tenantBundleLoader) {
    const cache = options.cache ?? createMemoryCache();
    for (const namespace of options.namespaces) {
      const cacheKey = buildCacheKey(options.tenantId, options.locale, namespace);
      let bundle = cache.get(cacheKey);
      if (!bundle) {
        const loaded = await options.tenantBundleLoader.load({
          tenantId: options.tenantId,
          locale: options.locale,
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

  return createProviderFromBundles({
    locale: options.locale,
    bundles: resolvedBundles,
    fallbackLocale: options.fallbackLocale,
    mode: options.mode ?? 'prod',
  });
}

export function createProviderFromBundles(options: {
  locale: string;
  bundles: TranslationBundle[];
  fallbackLocale?: string;
  mode?: 'dev' | 'prod';
}): I18nProvider {
  const mode = options.mode ?? 'prod';
  const bundleIndex = indexBundles(options.bundles);

  return {
    locale: options.locale,
    direction: resolveDirection(options.locale),
    t: (key, params, translateOptions) => {
      const { namespace, entryKey } = resolveKey(key, translateOptions);
      const message = resolveMessage(bundleIndex, options.locale, namespace, entryKey, options.fallbackLocale);
      if (!message) {
        if (mode === 'dev') return key;
        return translateOptions?.defaultText ?? '';
      }
      return formatMessage(message, options.locale, params);
    },
    has: (key, translateOptions) => {
      const { namespace, entryKey } = resolveKey(key, translateOptions);
      return !!resolveMessage(bundleIndex, options.locale, namespace, entryKey, options.fallbackLocale);
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
  locale: string,
  namespace: string,
  entryKey: string,
  fallbackLocale?: string,
): string | undefined {
  const local = lookupMessage(index, locale, namespace, entryKey);
  if (local) return local;
  if (fallbackLocale) {
    return lookupMessage(index, fallbackLocale, namespace, entryKey);
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
