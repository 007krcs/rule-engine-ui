import { NextResponse } from 'next/server';
import { diffVersion } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const url = new URL(request.url);
  const against = url.searchParams.get('against');

  const result = await diffVersion({ versionId, againstVersionId: against });
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}

