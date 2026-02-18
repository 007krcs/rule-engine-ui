import type { FlowSchema, UISchema } from '@platform/schema';
import { getConfigVersion, updateUiSchema } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

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
    const blocked = await requirePolicy({
      stage: 'save',
      requiredRole: 'Author',
      metadata: { route: 'config-versions.update-ui', versionId },
    });
    if (blocked) {
      return blocked;
    }

    const body = (await request.json().catch(() => null)) as
      | null
      | {
          uiSchema?: unknown;
          uiSchemasById?: unknown;
          activeUiPageId?: unknown;
          flowSchema?: unknown;
        };
    const hasUiSchema = Boolean(body?.uiSchema);
    const hasUiSchemasById =
      body?.uiSchemasById && typeof body.uiSchemasById === 'object' && !Array.isArray(body.uiSchemasById);

    if (!body || (!hasUiSchema && !hasUiSchemasById)) {
      return noStoreJson({ ok: false, error: 'uiSchema or uiSchemasById is required' }, 400);
    }

    const result = await updateUiSchema({
      versionId,
      uiSchema: body.uiSchema as UISchema | undefined,
      uiSchemasById: body.uiSchemasById as Record<string, UISchema> | undefined,
      activeUiPageId: typeof body.activeUiPageId === 'string' ? body.activeUiPageId : undefined,
      flowSchema: body.flowSchema as FlowSchema | undefined,
    });
    if (!result.ok) {
      const status =
        result.error === 'policy_failed'
          ? 403
          : result.error === 'version_killed'
            ? 409
          : result.error === 'uiSchema or uiSchemasById is required'
            ? 400
            : 404;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}

