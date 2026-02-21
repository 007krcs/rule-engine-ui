import { afterEach, describe, expect, it } from 'vitest';
import {
  createInMemoryEncryptedSecretStore,
  resetDefaultSecretStoreForTests,
  resolveSecret,
  setDefaultSecretStoreForTests,
} from '../src/server/secrets';

describe('secret store', () => {
  afterEach(() => {
    resetDefaultSecretStoreForTests();
  });

  it('stores and resolves tenant-scoped encrypted secrets', async () => {
    const store = createInMemoryEncryptedSecretStore();
    await store.setSecret({
      tenantId: 'tenant-1',
      key: 'partner_token',
      value: 'secret-value',
    });
    setDefaultSecretStoreForTests(store);
    const resolved = await resolveSecret({
      tenantId: 'tenant-1',
      secretRef: 'partner_token',
    });
    expect(resolved).toBe('secret-value');
  });
});
