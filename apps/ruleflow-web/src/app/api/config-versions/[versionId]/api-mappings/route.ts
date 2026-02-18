import type { ApiMapping } from '@platform/schema';
import { updateApiMappings } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  return withApiErrorHandling(async () => {
    const { versionId } = await params;
    const blocked = await requirePolicy({
      stage: 'save',
      requiredRole: 'Author',
      metadata: { route: 'config-versions.api-mappings.patch', versionId },
    });
    if (blocked) {
      return blocked;
    }

    const body = (await request.json().catch(() => null)) as
      | null
      | { apiMappingsById?: unknown };
    if (!body?.apiMappingsById || typeof body.apiMappingsById !== 'object' || Array.isArray(body.apiMappingsById)) {
      return noStoreJson({ ok: false, error: 'apiMappingsById is required' }, 400);
    }

    const result = await updateApiMappings({
      versionId,
      apiMappingsById: body.apiMappingsById as Record<string, ApiMapping>,
    });
    if (!result.ok) {
      const status = result.error === 'policy_failed' ? 403 : result.error === 'version_killed' ? 409 : 404;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}
