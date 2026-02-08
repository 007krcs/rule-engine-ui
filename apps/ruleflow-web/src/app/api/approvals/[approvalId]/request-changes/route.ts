import { NextResponse } from 'next/server';
import { requestChanges } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ approvalId: string }> }) {
  const { approvalId } = await params;
  const body = (await request.json().catch(() => null)) as null | { notes?: string };
  const result = await requestChanges({ approvalId, notes: body?.notes });
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}

