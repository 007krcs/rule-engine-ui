import { NextResponse } from 'next/server';
import { approveRequest } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ approvalId: string }> }) {
  const { approvalId } = await params;
  const result = await approveRequest({ approvalId });
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}

