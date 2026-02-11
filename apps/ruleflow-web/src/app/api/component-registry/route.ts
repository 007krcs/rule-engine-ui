import { NextResponse } from 'next/server';
import type { ComponentRegistryManifest, RegistryScope } from '@platform/component-registry';
import { getComponentRegistrySnapshot, registerComponentRegistryManifest } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId') ?? undefined;
  const snapshot = await getComponentRegistrySnapshot({ tenantId: tenantId ?? undefined });
  return NextResponse.json(snapshot, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as null | {
    scope?: RegistryScope;
    tenantId?: string;
    manifest?: unknown;
  };

  const scope = body?.scope;
  if (scope !== 'global' && scope !== 'tenant') {
    return NextResponse.json({ ok: false, error: 'scope must be global|tenant' }, { status: 400 });
  }

  if (!body?.manifest) {
    return NextResponse.json({ ok: false, error: 'manifest is required' }, { status: 400 });
  }

  const manifest = body.manifest as ComponentRegistryManifest;
  const result = await registerComponentRegistryManifest({ scope, tenantId: body.tenantId, manifest });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}

