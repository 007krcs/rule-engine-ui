import type { RuleSet } from '@platform/schema';
import { updateRules } from '@/server/demo/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  return withApiErrorHandling(async () => {
    const { versionId } = await params;
    const body = (await request.json().catch(() => null)) as null | { rules?: unknown };
    if (!body || !body.rules) {
      return noStoreJson({ ok: false, error: 'rules is required' }, 400);
    }

    const rules = body.rules as RuleSet;
    const result = await updateRules({ versionId, rules });
    if (!result.ok) {
      return noStoreJson(result, 404);
    }
    return noStoreJson(result);
  });
}
