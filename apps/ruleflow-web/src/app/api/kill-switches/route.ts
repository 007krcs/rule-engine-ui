import type { KillScope } from '@platform/persistence-postgres';
import { listKillSwitches, upsertKillSwitch } from '@/server/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET() {
  return withApiErrorHandling(async () => {
    const result = await listKillSwitches();
    return noStoreJson(result);
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const body = (await request.json().catch(() => null)) as null | {
      scope?: KillScope;
      active?: boolean;
      packageId?: string;
      versionId?: string;
      rulesetKey?: string;
      reason?: string;
    };
    if (!body || typeof body.scope !== 'string' || typeof body.active !== 'boolean') {
      return noStoreJson({ ok: false, error: 'scope and active are required' }, 400);
    }
    const result = await upsertKillSwitch({
      scope: body.scope,
      active: body.active,
      packageId: body.packageId,
      versionId: body.versionId,
      rulesetKey: body.rulesetKey,
      reason: body.reason,
    });
    if (!result.ok) {
      const status = result.error === 'policy_failed' ? 403 : 400;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}
