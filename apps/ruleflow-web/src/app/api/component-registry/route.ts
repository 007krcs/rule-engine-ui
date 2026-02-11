import type { ComponentRegistryManifest, RegistryScope } from '@platform/component-registry';
import { getComponentRegistrySnapshot, registerComponentRegistryManifest } from '@/server/demo/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId') ?? undefined;
    const snapshot = await getComponentRegistrySnapshot({ tenantId: tenantId ?? undefined });
    return noStoreJson(snapshot);
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const body = (await request.json().catch(() => null)) as null | {
      scope?: RegistryScope;
      tenantId?: string;
      manifest?: unknown;
    };

    const scope = body?.scope;
    if (scope !== 'global' && scope !== 'tenant') {
      return noStoreJson({ ok: false, error: 'scope must be global|tenant' }, 400);
    }

    if (!body?.manifest) {
      return noStoreJson({ ok: false, error: 'manifest is required' }, 400);
    }

    const manifest = body.manifest as ComponentRegistryManifest;
    const result = await registerComponentRegistryManifest({ scope, tenantId: body.tenantId, manifest });
    if (!result.ok) {
      return noStoreJson(result, 400);
    }
    return noStoreJson(result);
  });
}
