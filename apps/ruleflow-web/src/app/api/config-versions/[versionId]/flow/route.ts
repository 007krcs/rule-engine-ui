import type { FlowSchema } from '@platform/schema';
import { updateFlowSchema } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  return withApiErrorHandling(async () => {
    const { versionId } = await params;
    const blocked = await requirePolicy({
      stage: 'save',
      requiredRole: 'Author',
      metadata: { route: 'config-versions.flow.patch', versionId },
    });
    if (blocked) {
      return blocked;
    }

    const body = (await request.json().catch(() => null)) as null | { flowSchema?: unknown };
    if (!body?.flowSchema || typeof body.flowSchema !== 'object' || Array.isArray(body.flowSchema)) {
      return noStoreJson({ ok: false, error: 'flowSchema is required' }, 400);
    }

    const result = await updateFlowSchema({
      versionId,
      flowSchema: body.flowSchema as FlowSchema,
    });
    if (!result.ok) {
      const status = result.error === 'policy_failed' ? 403 : result.error === 'version_killed' ? 409 : 404;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}
