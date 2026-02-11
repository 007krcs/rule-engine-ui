import { describe, expect, it } from 'vitest';
import { builtinComponentDefinitions, validateComponentRegistryManifest } from '../src/index';

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
          category: 'Company',
          propsSchema: { type: 'object' },
        },
        {
          adapterHint: 'company.currencyInput',
          displayName: 'Currency 2',
          category: 'Company',
          propsSchema: { type: 'object' },
        },
      ],
    };
    const result = validateComponentRegistryManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('duplicate'))).toBe(true);
  });
});

