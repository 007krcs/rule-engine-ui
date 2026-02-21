import type { JSONValue } from '@platform/schema';
import { migrateBundleToMultiPage } from '@platform/schema';

export type GovernanceSdkOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
};

export type PolicyStage = 'save' | 'submit-for-review' | 'approve' | 'promote';
export type KillScope = 'TENANT' | 'RULESET' | 'VERSION' | 'COMPONENT';

export class GovernanceSdk {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;

  constructor(options: GovernanceSdkOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.headers = { 'content-type': 'application/json', ...(options.headers ?? {}) };
  }

  async evaluatePolicy(input: {
    stage: PolicyStage;
    currentBundle?: Record<string, JSONValue>;
    nextBundle?: Record<string, JSONValue>;
    metadata?: Record<string, JSONValue>;
  }): Promise<{ ok: boolean; mode?: 'shadow' | 'enforce'; errors?: unknown[]; error?: string }> {
    return await this.post('/api/policies/evaluate', input);
  }

  async upsertFeatureFlag(input: {
    env: string;
    key: string;
    enabled: boolean;
    value?: Record<string, JSONValue>;
  }): Promise<{ ok: boolean; flag?: unknown; error?: string }> {
    return await this.post('/api/feature-flags', input);
  }

  async upsertKillSwitch(input: {
    scope: KillScope;
    active: boolean;
    packageId?: string;
    versionId?: string;
    componentId?: string;
    reason?: string;
  }): Promise<{ ok: boolean; killSwitch?: unknown; error?: string }> {
    return await this.post('/api/kill-switches', input);
  }

  migrateBundle(bundle: Record<string, JSONValue>): ReturnType<typeof migrateBundleToMultiPage<Record<string, JSONValue>>> {
    return migrateBundleToMultiPage(bundle);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    return (await response.json()) as T;
  }
}

export { migrateBundleToMultiPage } from '@platform/schema';
