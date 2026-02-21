import type { KillScope } from '@platform/persistence-postgres';
import { listKillSwitches, upsertKillSwitch } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET() {
  return withApiErrorHandling(async () => {
    const result = await listKillSwitches();
    return noStoreJson(result);
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const blocked = await requirePolicy({
      stage: 'promote',
      requiredRole: 'Publisher',
      metadata: { route: 'kill-switches.upsert' },
    });
    if (blocked) {
      return blocked;
    }

    const body = (await request.json().catch(() => null)) as null | {
      scope?: KillScope;
      active?: boolean;
      packageId?: string;
      versionId?: string;
      componentId?: string;
      rulesetKey?: string;
      reason?: string;
    };
    if (!body || typeof body.scope !== 'string' || typeof body.active !== 'boolean') {
      return noStoreJson({ ok: false, error: 'scope and active are required' }, 400);
    }
    if (body.scope === 'COMPONENT' && typeof body.componentId !== 'string' && typeof body.rulesetKey !== 'string') {
      return noStoreJson({ ok: false, error: 'componentId is required for COMPONENT scope' }, 400);
    }
    const result = await upsertKillSwitch({
      scope: body.scope,
      active: body.active,
      packageId: body.packageId,
      versionId: body.versionId,
      componentId: body.componentId,
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
