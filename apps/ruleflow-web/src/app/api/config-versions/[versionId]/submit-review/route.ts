import { NextResponse } from 'next/server';
import { submitForReview } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const body = (await request.json().catch(() => null)) as null | { scope?: string; risk?: string };
  const scope = body?.scope?.trim();
  const risk = body?.risk;

  if (!scope || !risk) {
    return NextResponse.json({ ok: false, error: 'scope and risk are required' }, { status: 400 });
  }
  if (risk !== 'Low' && risk !== 'Medium' && risk !== 'High') {
    return NextResponse.json({ ok: false, error: 'risk must be Low|Medium|High' }, { status: 400 });
  }

  const result = await submitForReview({ versionId, scope, risk });
  if (!result.ok) {
    const status = result.error === 'Version not found' ? 404 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
