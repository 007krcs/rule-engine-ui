# I18n

Translation runtime with locale direction, bundle loaders, and caching.

Purpose
Resolve translation keys with fallback behavior and per-tenant overrides.

Exports
- `createI18nProvider` and `createProviderFromBundles`
- `createMemoryCache`, `createMockTenantLoader`, `createHttpBundleLoader`
- `createDynamicImportBundleLoader` for lazy locale/namespace imports
- `createDevelopmentMachineTranslator` for development/staging prefill workflows
- `resolveLocalizedTheme` for per-locale token overrides

When to modify
Add new loader types or adjust fallback strategy.

When not to touch
Do not remove RTL locale handling or change cache semantics without a migration plan.
