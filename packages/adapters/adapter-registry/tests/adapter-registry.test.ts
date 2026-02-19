import { describe, expect, it } from 'vitest';
import {
  listRuntimeAdapterPackDefinitions,
  registerRuntimeAdapterPackDefinition,
  resetAdapterRegistryStateForTests,
  resolveRuntimeAdapterPackIds,
} from '../src/index';

describe('adapter-registry', () => {
  it('registers and resolves runtime adapter pack definitions', () => {
    resetAdapterRegistryStateForTests();
    registerRuntimeAdapterPackDefinition({
      id: 'custom',
      prefix: 'custom.',
      defaultEnabled: false,
      external: true,
    });

    const definitions = listRuntimeAdapterPackDefinitions();
    expect(definitions.some((definition) => definition.id === 'custom')).toBe(true);

    const enabled = resolveRuntimeAdapterPackIds({ 'adapter.custom': true });
    expect(enabled.includes('custom')).toBe(true);
  });
});
