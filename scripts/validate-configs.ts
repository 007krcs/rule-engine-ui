import type { UISchema } from '@platform/schema';
import exampleUi from '@platform/schema/examples/example.ui.json';
import { validateI18nCoverage, validateUISchema } from '@platform/validator';
import { EXAMPLE_TENANT_BUNDLES, PLATFORM_BUNDLES } from '@platform/i18n';

const uiSchema = exampleUi as unknown as UISchema;

const schemaResult = validateUISchema(uiSchema);
if (!schemaResult.valid) {
  console.error('Schema validation failed:');
  for (const issue of schemaResult.issues) {
    console.error(`- ${issue.path}: ${issue.message}`);
  }
  process.exit(1);
}

const i18nResult = validateI18nCoverage(uiSchema, {
  locales: ['en', 'de', 'fr', 'hi', 'ar'],
  bundles: [...PLATFORM_BUNDLES, ...EXAMPLE_TENANT_BUNDLES],
});

if (!i18nResult.valid) {
  console.error('I18n validation failed:');
  for (const issue of i18nResult.issues) {
    console.error(`- ${issue.path}: ${issue.message}`);
  }
  process.exit(1);
}

console.log('Config validation passed.');