import type { RuleSet } from '@platform/schema';
import { updateRules } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  return withApiErrorHandling(async () => {
    const { versionId } = await params;
    const blocked = await requirePolicy({
      stage: 'save',
      requiredRole: 'Author',
      metadata: { route: 'config-versions.rules.patch', versionId },
    });
    if (blocked) {
      return blocked;
    }

    const body = (await request.json().catch(() => null)) as null | { rules?: unknown };
    if (!body || !body.rules) {
      return noStoreJson({ ok: false, error: 'rules is required' }, 400);
    }

    const rules = body.rules as RuleSet;
    const result = await updateRules({ versionId, rules });
    if (!result.ok) {
      const status = result.error === 'policy_failed' ? 403 : result.error === 'version_killed' ? 409 : 404;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}



