import { NextResponse } from 'next/server';
import type { UISchema } from '@platform/schema';
import { getConfigVersion, updateUiSchema } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const version = await getConfigVersion(versionId);
  if (!version) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, version }, { headers: { 'cache-control': 'no-store' } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const body = (await request.json().catch(() => null)) as null | { uiSchema?: unknown };
  if (!body || !body.uiSchema) {
    return NextResponse.json({ ok: false, error: 'uiSchema is required' }, { status: 400 });
  }

  const uiSchema = body.uiSchema as UISchema;
  const result = await updateUiSchema({ versionId, uiSchema });
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
