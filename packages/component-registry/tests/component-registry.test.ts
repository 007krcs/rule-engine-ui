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
    expect(isImplemented('platform.svgIcon', definitions)).toBe(true);
    expect(isImplemented('platform.imageList', definitions)).toBe(true);
  });

  it('marks planned entries as non-draggable by default', () => {
    const definitions = builtinComponentDefinitions();
    const planned = definitions.find((definition) => definition.adapterHint === 'platform.transitionGrow');
    expect(planned).toBeTruthy();
    expect(planned?.availability).toBe('planned');
    expect(planned?.supportsDrag).toBe(false);
    expect(planned ? isPaletteComponentEnabled(planned) : true).toBe(false);
  });

  it('enables external entries only when their adapter prefix is registered', () => {
    const definitions = builtinComponentDefinitions();
    const external = definitions.find((definition) => definition.adapterHint === 'material.input');
    expect(external).toBeTruthy();
    if (!external) return;

    expect(isPaletteComponentEnabled(external)).toBe(false);
    expect(
      isPaletteComponentEnabled(external, {
        enabledAdapterPrefixes: ['material.'],
      }),
    ).toBe(true);
    expect(
      isPaletteComponentEnabled(external, {
        enabledAdapterPrefixes: ['aggrid.'],
      }),
    ).toBe(false);
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

  it('ships dummy defaults for upgraded platform previews', () => {
    const definitions = builtinComponentDefinitions();
    const upgradedHints = [
      'platform.svgIcon',
      'platform.imageList',
      'platform.paper',
      'platform.bottomNavigation',
      'platform.speedDial',
      'platform.link',
      'platform.masonry',
      'platform.noSsr',
      'platform.portal',
      'platform.clickAwayListener',
      'platform.popper',
      'platform.transitionFade',
    ];
    upgradedHints.forEach((hint) => {
      const definition = definitions.find((entry) => entry.adapterHint === hint);
      expect(definition).toBeTruthy();
      expect(definition?.availability).toBe('implemented');
      expect(definition?.supportsDrag).toBe(true);
      expect(definition?.defaultProps).toBeTruthy();
      expect(definition?.examples?.length ?? 0).toBeGreaterThan(0);
    });
  });
});
