import { describe, expect, it } from 'vitest';
import {
  builtinComponentDefinitions,
  isPaletteComponentEnabled,
} from '@platform/component-registry';

describe('builder palette external adapter gating', () => {
  it('hides material components when material adapter prefix is not enabled', () => {
    const materialInput = builtinComponentDefinitions().find(
      (definition) => definition.adapterHint === 'material.input',
    );

    expect(materialInput).toBeTruthy();
    if (!materialInput) return;

    expect(
      isPaletteComponentEnabled(materialInput, {
        enabledAdapterPrefixes: ['platform.', 'aggrid.'],
      }),
    ).toBe(false);
  });

  it('shows material components when material adapter prefix is enabled', () => {
    const materialInput = builtinComponentDefinitions().find(
      (definition) => definition.adapterHint === 'material.input',
    );

    expect(materialInput).toBeTruthy();
    if (!materialInput) return;

    expect(
      isPaletteComponentEnabled(materialInput, {
        enabledAdapterPrefixes: ['platform.', 'material.'],
      }),
    ).toBe(true);
  });
});
