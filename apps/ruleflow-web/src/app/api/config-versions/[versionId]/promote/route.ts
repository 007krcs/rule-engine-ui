import { NextResponse } from 'next/server';
import { promoteVersion } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const result = await promoteVersion({ versionId });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}

