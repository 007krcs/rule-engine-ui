import { NextResponse } from 'next/server';
import type { RuleSet } from '@platform/schema';
import { updateRules } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const body = (await request.json().catch(() => null)) as null | { rules?: unknown };
  if (!body || !body.rules) {
    return NextResponse.json({ ok: false, error: 'rules is required' }, { status: 400 });
  }

  const rules = body.rules as RuleSet;
  const result = await updateRules({ versionId, rules });
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}

