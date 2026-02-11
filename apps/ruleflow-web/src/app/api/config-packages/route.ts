import { NextResponse } from 'next/server';
import { createConfigPackage } from '@/server/demo/repository';
import { sampleTemplateById, type SampleTemplateId } from '@/lib/samples';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as null | {
    name?: string;
    description?: string;
    templateId?: string;
    tenantId?: string;
    configId?: string;
  };
  if (!body || typeof body.name !== 'string') {
    return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
  }

  const templateId = body.templateId?.trim();
  if (templateId && !(templateId in sampleTemplateById)) {
    return NextResponse.json({ ok: false, error: `unknown templateId: ${templateId}` }, { status: 400 });
  }

  const result = await createConfigPackage({
    name: body.name,
    description: body.description,
    templateId: templateId ? (templateId as SampleTemplateId) : undefined,
    tenantId: body.tenantId,
    configId: body.configId,
  });
  return NextResponse.json({ ok: true, ...result }, { headers: { 'cache-control': 'no-store' } });
}
