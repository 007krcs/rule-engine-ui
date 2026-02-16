import type { UISchema } from '@platform/schema';
import { getConfigVersion, updateUiSchema } from '@/server/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  return withApiErrorHandling(async () => {
    const { versionId } = await params;
    const version = await getConfigVersion(versionId);
    if (!version) {
      return noStoreJson({ ok: false, error: 'not_found' }, 404);
    }
    return noStoreJson({ ok: true, version });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  return withApiErrorHandling(async () => {
    const { versionId } = await params;
    const body = (await request.json().catch(() => null)) as null | { uiSchema?: unknown };
    if (!body || !body.uiSchema) {
      return noStoreJson({ ok: false, error: 'uiSchema is required' }, 400);
    }

    const uiSchema = body.uiSchema as UISchema;
    const result = await updateUiSchema({ versionId, uiSchema });
    if (!result.ok) {
      const status = result.error === 'policy_failed' ? 403 : 404;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}



