import { createConfigPackage } from '@/server/repository';
import { sampleTemplateById, type SampleTemplateId } from '@/lib/samples';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const blocked = await requirePolicy({
      stage: 'save',
      requiredRole: 'Author',
      metadata: { route: 'config-packages.create' },
    });
    if (blocked) {
      return blocked;
    }

    const body = (await request.json().catch(() => null)) as null | {
      name?: string;
      description?: string;
      templateId?: string;
      tenantId?: string;
      configId?: string;
    };
    if (!body || typeof body.name !== 'string') {
      return noStoreJson({ ok: false, error: 'name is required' }, 400);
    }

    const templateId = body.templateId?.trim();
    if (templateId && !(templateId in sampleTemplateById)) {
      return noStoreJson({ ok: false, error: `unknown templateId: ${templateId}` }, 400);
    }

    const result = await createConfigPackage({
      name: body.name,
      description: body.description,
      templateId: templateId ? (templateId as SampleTemplateId) : undefined,
      tenantId: body.tenantId,
      configId: body.configId,
    });
    if ('ok' in result && result.ok === false) {
      const status = result.error === 'policy_failed' ? 403 : 400;
      return noStoreJson(result, status);
    }
    return noStoreJson({ ok: true, ...result });
  });
}

