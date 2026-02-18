import type { JsonRecord } from '@platform/persistence-postgres';
import { listFeatureFlags, upsertFeatureFlag } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const url = new URL(request.url);
    const env = url.searchParams.get('env') ?? undefined;
    const result = await listFeatureFlags({ env });
    return noStoreJson(result);
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const blocked = await requirePolicy({
      stage: 'promote',
      requiredRole: 'Publisher',
      metadata: { route: 'feature-flags.upsert' },
    });
    if (blocked) {
      return blocked;
    }

    const body = (await request.json().catch(() => null)) as null | {
      env?: string;
      key?: string;
      enabled?: boolean;
      value?: JsonRecord;
    };
    if (!body || typeof body.env !== 'string' || typeof body.key !== 'string' || typeof body.enabled !== 'boolean') {
      return noStoreJson({ ok: false, error: 'env, key, enabled are required' }, 400);
    }
    const result = await upsertFeatureFlag({
      env: body.env,
      key: body.key,
      enabled: body.enabled,
      value: body.value,
    });
    if (!result.ok) {
      const status = result.error === 'policy_failed' ? 403 : 400;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}
