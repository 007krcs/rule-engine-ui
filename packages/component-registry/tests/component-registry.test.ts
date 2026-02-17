import { describe, expect, it } from 'vitest';
import {
  builtinComponentDefinitions,
  isImplemented,
  isPaletteComponentEnabled,
  listImplemented,
  validateComponentRegistryManifest,
} from '../src/index';

describe('@platform/component-registry', () => {
  it('validates a manifest with builtin components', () => {
    const manifest = { schemaVersion: 1 as const, components: builtinComponentDefinitions() };
    const result = validateComponentRegistryManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('rejects duplicate adapter hints', () => {
    const manifest = {
      schemaVersion: 1 as const,
      components: [
        {
          adapterHint: 'company.currencyInput',
          displayName: 'Currency',
          description: 'Currency input',
          category: 'Company',
          propsSchema: { type: 'object' },
        },
        {
          adapterHint: 'company.currencyInput',
          displayName: 'Currency 2',
          description: 'Currency input two',
          category: 'Company',
          propsSchema: { type: 'object' },
        },
      ],
    };
    const result = validateComponentRegistryManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('duplicate'))).toBe(true);
  });

  it('includes date and time platform metadata', () => {
    const definitions = builtinComponentDefinitions();
    const dateField = definitions.find((definition) => definition.adapterHint === 'platform.dateField');
    const calendar = definitions.find((definition) => definition.adapterHint === 'platform.calendar');
    const clock = definitions.find((definition) => definition.adapterHint === 'platform.clock');

    expect(dateField).toBeTruthy();
    expect(dateField?.status).toBe('stable');
    expect(dateField?.bindings?.data).toContain('valuePath');
    expect(dateField?.schemaSupport?.allowedProps?.length).toBeGreaterThan(0);

    expect(calendar).toBeTruthy();
    expect(calendar?.tokensUsed?.length).toBeGreaterThan(0);

    expect(clock).toBeTruthy();
    expect(clock?.i18n?.nameKey).toContain('registry.components.platform.clock');
  });

  it('tracks implemented availability explicitly', () => {
    const definitions = builtinComponentDefinitions();
    const implemented = listImplemented(definitions);
    expect(implemented.length).toBeGreaterThan(0);
    expect(isImplemented('platform.chip', definitions)).toBe(true);
    expect(isImplemented('platform.svgIcon', definitions)).toBe(false);
  });

  it('marks planned entries as non-draggable by default', () => {
    const definitions = builtinComponentDefinitions();
    const planned = definitions.find((definition) => definition.adapterHint === 'platform.svgIcon');
    expect(planned).toBeTruthy();
    expect(planned?.availability).toBe('planned');
    expect(planned?.supportsDrag).toBe(false);
    expect(planned ? isPaletteComponentEnabled(planned) : true).toBe(false);
  });

  it('requires availability on custom definitions', () => {
    const manifest = {
      schemaVersion: 1 as const,
      components: [
        {
          id: 'platform.customThing',
          adapterHint: 'platform.customThing',
          displayName: 'Custom Thing',
          description: 'Custom',
          category: 'Inputs',
          propsSchema: { type: 'object' },
        },
      ],
    };
    const result = validateComponentRegistryManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path.endsWith('availability'))).toBe(true);
  });
});
