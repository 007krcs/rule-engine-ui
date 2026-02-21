import crypto from 'node:crypto';

type SecretKey = `${string}:${string}`;

export interface SecretStore {
  setSecret(input: { tenantId: string; key: string; value: string }): Promise<void>;
  getSecret(input: { tenantId: string; key: string }): Promise<string | undefined>;
}

type EncryptedSecret = {
  iv: string;
  tag: string;
  cipherText: string;
};

function normalize(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function toStoreKey(tenantId: string, key: string): SecretKey {
  return `${normalize(tenantId)}:${normalize(key)}`;
}

function resolveMasterKey(): Buffer {
  const raw = process.env.RULEFLOW_SECRET_MASTER_KEY?.trim();
  if (!raw) {
    return crypto.createHash('sha256').update('ruleflow-local-dev-master-key', 'utf8').digest();
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

function encrypt(value: string, key: Buffer): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const cipherText = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    cipherText: cipherText.toString('base64'),
  };
}

function decrypt(value: EncryptedSecret, key: Buffer): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(value.cipherText, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}

class InMemoryEncryptedSecretStore implements SecretStore {
  private readonly masterKey: Buffer;
  private readonly values = new Map<SecretKey, EncryptedSecret>();

  constructor(masterKey = resolveMasterKey()) {
    this.masterKey = masterKey;
  }

  async setSecret(input: { tenantId: string; key: string; value: string }): Promise<void> {
    const storeKey = toStoreKey(input.tenantId, input.key);
    this.values.set(storeKey, encrypt(input.value, this.masterKey));
  }

  async getSecret(input: { tenantId: string; key: string }): Promise<string | undefined> {
    const storeKey = toStoreKey(input.tenantId, input.key);
    const encrypted = this.values.get(storeKey);
    if (!encrypted) return undefined;
    return decrypt(encrypted, this.masterKey);
  }
}

class EnvSecretStore implements SecretStore {
  async setSecret(): Promise<void> {
    throw new Error('EnvSecretStore is read-only. Set env vars instead.');
  }

  async getSecret(input: { tenantId: string; key: string }): Promise<string | undefined> {
    const tenant = normalize(input.tenantId).toUpperCase();
    const key = normalize(input.key).toUpperCase();
    const tenantScoped = process.env[`RULEFLOW_SECRET_${tenant}_${key}`];
    if (tenantScoped) return tenantScoped;
    return process.env[`RULEFLOW_SECRET_${key}`];
  }
}

let defaultSecretStore: SecretStore = new EnvSecretStore();

export function setDefaultSecretStoreForTests(store: SecretStore): void {
  defaultSecretStore = store;
}

export function resetDefaultSecretStoreForTests(): void {
  defaultSecretStore = new EnvSecretStore();
}

export function createInMemoryEncryptedSecretStore(): SecretStore {
  return new InMemoryEncryptedSecretStore();
}

export function createEnvSecretStore(): SecretStore {
  return new EnvSecretStore();
}

export async function resolveSecret(input: { tenantId: string; secretRef: string }): Promise<string | undefined> {
  return await defaultSecretStore.getSecret({
    tenantId: input.tenantId,
    key: input.secretRef,
  });
}
