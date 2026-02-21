import { describe, expect, it, vi } from 'vitest';
import {
  createDevelopmentMachineTranslator,
  createDynamicImportBundleLoader,
  createI18nProvider,
  createMemoryCache,
  createProviderFromBundles,
  createMockTenantLoader,
  EXAMPLE_TENANT_BUNDLES,
  PLATFORM_BUNDLES,
  resolveLocale,
  upsertBundleMessage,
} from '../src/index';

describe('i18n', () => {
  it('resolves translations and fallbacks', () => {
    const provider = createProviderFromBundles({
      locale: 'en',
      bundles: PLATFORM_BUNDLES,
      fallbackLocale: 'en',
      mode: 'prod',
    });
    expect(provider.t('runtime.filters.customerName.label')).toBe('Customer name');
    expect(provider.t('runtime.unknown', undefined, { defaultText: 'Fallback' })).toBe('Fallback');
  });

  it('returns keys in dev mode when missing', () => {
    const provider = createProviderFromBundles({
      locale: 'en',
      bundles: PLATFORM_BUNDLES,
      mode: 'dev',
    });
    expect(provider.t('runtime.missing.key')).toBe('runtime.missing.key');
  });

  it('detects RTL locales', () => {
    const provider = createProviderFromBundles({
      locale: 'ar',
      bundles: EXAMPLE_TENANT_BUNDLES,
    });
    expect(provider.direction).toBe('rtl');
  });

  it('caches tenant bundles', async () => {
    const cache = createMemoryCache(1000);
    const loader = createMockTenantLoader(EXAMPLE_TENANT_BUNDLES);
    const spy = vi.spyOn(loader, 'load');

    await createI18nProvider({
      locale: 'ar',
      tenantId: 'tenant-1',
      namespaces: ['runtime'],
      tenantBundleLoader: loader,
      cache,
      platformBundles: [],
    });
    await createI18nProvider({
      locale: 'ar',
      tenantId: 'tenant-1',
      namespaces: ['runtime'],
      tenantBundleLoader: loader,
      cache,
      platformBundles: [],
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('expires cache entries', () => {
    vi.useFakeTimers();
    const cache = createMemoryCache(10);
    cache.set('key', { locale: 'en', namespace: 'runtime', messages: { hello: 'hi' } }, 10);
    vi.advanceTimersByTime(11);
    expect(cache.get('key')).toBeUndefined();
    vi.useRealTimers();
  });

  it('resolves locale from user/tenant settings with fallback', () => {
    expect(
      resolveLocale({
        tenantLocale: 'de-DE',
        userLocale: 'fr-CA',
        fallbackLocale: 'en',
        supportedLocales: ['en', 'fr', 'de'],
      }),
    ).toBe('fr');

    expect(
      resolveLocale({
        tenantLocale: 'es-MX',
        userLocale: null,
        fallbackLocale: 'en',
        supportedLocales: ['en', 'de'],
      }),
    ).toBe('en');
  });

  it('upserts and updates bundle messages', () => {
    const seed = [{ locale: 'en', namespace: 'runtime', messages: { hello: 'Hello' } }];
    const added = upsertBundleMessage(seed, {
      locale: 'en',
      namespace: 'runtime',
      key: 'bye',
      value: 'Bye',
    });
    expect(added[0]?.messages.bye).toBe('Bye');

    const updated = upsertBundleMessage(added, {
      locale: 'en',
      namespace: 'runtime',
      key: 'hello',
      value: 'Hello there',
    });
    expect(updated[0]?.messages.hello).toBe('Hello there');
  });

  it('supports dynamic import bundle loader with locale fallback', async () => {
    const loader = createDynamicImportBundleLoader({
      importer: async ({ locale }) => {
        if (locale === 'fr') {
          return {
            messages: {
              'filters.customerName.label': 'Nom client dynamique',
            },
          };
        }
        throw new Error('missing');
      },
    });

    const provider = await createI18nProvider({
      locale: 'fr-CA',
      namespaces: ['runtime'],
      tenantBundleLoader: loader,
      platformBundles: [],
      fallbackLocale: 'en',
    });

    expect(provider.t('runtime.filters.customerName.label')).toBe('Nom client dynamique');
  });

  it('prefills missing keys via machine translation in development', async () => {
    const prevEnv = process.env.RULEFLOW_ENV;
    process.env.RULEFLOW_ENV = 'development';
    const loader = createMockTenantLoader([]);
    const provider = await createI18nProvider({
      locale: 'es',
      namespaces: ['runtime'],
      tenantBundleLoader: loader,
      platformBundles: [
        {
          locale: 'en',
          namespace: 'runtime',
          messages: { hello: 'Hello' },
        },
      ],
      machineTranslation: {
        enabled: true,
        envs: ['development'],
        provider: createDevelopmentMachineTranslator(),
      },
      mode: 'prod',
    });

    expect(provider.t('runtime.hello')).toContain('[MT es]');
    process.env.RULEFLOW_ENV = prevEnv;
  });

  it('resolves localized theme tokens', () => {
    const provider = createProviderFromBundles({
      locale: 'ar',
      bundles: PLATFORM_BUNDLES,
      localeThemes: {
        base: {
          'font.size.base': 14,
          'spacing.inline': 8,
        },
        byLocale: {
          ar: {
            'font.size.base': 15,
            'spacing.inline': 10,
          },
        },
      },
    });

    expect(provider.themeTokens['font.size.base']).toBe(15);
    expect(provider.themeTokens['spacing.inline']).toBe(10);
    expect(provider.direction).toBe('rtl');
  });
});
