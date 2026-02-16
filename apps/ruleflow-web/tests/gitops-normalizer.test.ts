import { describe, expect, it } from 'vitest';
import type { GitOpsPayload } from '@platform/persistence-postgres';
import type { GitOpsBundle } from '../src/lib/demo/types';
import {
  buildGitOpsBundlePayloadFromPostgres,
  normalizeGitOpsBundleForPostgres,
} from '../src/server/gitops';

describe('gitops normalizer', () => {
  it('normalizes demo-style nested versions into postgres payload', () => {
    const bundle: GitOpsBundle = {
      schemaVersion: 1,
      exportedAt: '2026-02-16T00:00:00.000Z',
      tenantId: 'tenant-1',
      payload: {
        packages: [
          {
            id: 'pkg-1',
            tenantId: 'tenant-1',
            configId: 'orders',
            name: 'Orders',
            createdAt: '2026-02-15T00:00:00.000Z',
            createdBy: 'Alice',
            versions: [
              {
                id: 'ver-1',
                packageId: 'pkg-1',
                version: '1.0.0',
                status: 'ACTIVE',
                createdAt: '2026-02-15T00:00:00.000Z',
                createdBy: 'Alice',
                bundle: {
                  uiSchema: { version: '1.0.0', pageId: 'page', layout: { id: 'root', type: 'stack', children: [] }, components: [] },
                  flowSchema: { version: '1.0.0', initialState: 'start', states: { start: { uiPageId: 'page', on: {} } } },
                  rules: { version: '1.0.0', rules: [] },
                  apiMappingsById: {},
                },
              },
            ],
          },
        ],
        approvals: [],
        audit: [],
      },
      signature: {
        alg: 'HMAC-SHA256',
        keyId: 'k1',
        value: 'sig',
      },
    };

    const normalized = normalizeGitOpsBundleForPostgres(bundle, 'tenant-1');
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.payload.packages).toHaveLength(1);
    expect(normalized.payload.versions).toHaveLength(1);
    expect(normalized.payload.versions[0]?.status).toBe('ACTIVE');
  });

  it('rejects versions that reference unknown packages', () => {
    const bundle: GitOpsBundle = {
      schemaVersion: 1,
      exportedAt: '2026-02-16T00:00:00.000Z',
      tenantId: 'tenant-1',
      payload: {
        packages: [],
        versions: [
          {
            id: 'ver-1',
            packageId: 'missing',
            version: '1.0.0',
            status: 'DRAFT',
            createdAt: '2026-02-15T00:00:00.000Z',
            createdBy: 'Alice',
            bundle: {
              uiSchema: { version: '1.0.0', pageId: 'page', layout: { id: 'root', type: 'stack', children: [] }, components: [] },
              flowSchema: { version: '1.0.0', initialState: 'start', states: { start: { uiPageId: 'page', on: {} } } },
              rules: { version: '1.0.0', rules: [] },
              apiMappingsById: {},
            },
          },
        ],
        approvals: [],
        audit: [],
      },
      signature: {
        alg: 'HMAC-SHA256',
        keyId: 'k1',
        value: 'sig',
      },
    };

    const normalized = normalizeGitOpsBundleForPostgres(bundle, 'tenant-1');
    expect(normalized.ok).toBe(false);
    if (normalized.ok) return;
    expect(normalized.error).toContain('unknown package');
  });

  it('builds ui-compatible payload from postgres export payload', () => {
    const payload: GitOpsPayload = {
      packages: [
        {
          id: 'pkg-1',
          tenantId: 'tenant-1',
          configId: 'orders',
          name: 'Orders',
          createdAt: '2026-02-15T00:00:00.000Z',
          createdBy: 'Alice',
        },
      ],
      versions: [
        {
          id: 'ver-1',
          tenantId: 'tenant-1',
          packageId: 'pkg-1',
          version: '1.0.0',
          status: 'ACTIVE',
          bundle: {},
          createdAt: '2026-02-15T00:00:00.000Z',
          createdBy: 'Alice',
          isKilled: false,
        },
      ],
      approvals: [],
      audit: [],
      featureFlags: [],
      killSwitches: [],
      branding: null,
    };

    const uiPayload = buildGitOpsBundlePayloadFromPostgres(payload);
    expect(uiPayload.packages).toHaveLength(1);
    expect(uiPayload.packages[0]?.versions).toHaveLength(1);
    expect(uiPayload.versions).toHaveLength(1);
  });
});
