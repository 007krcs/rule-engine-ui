import { NextResponse } from 'next/server';
import { getConsoleSnapshot } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function GET() {
  const snapshot = await getConsoleSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      'cache-control': 'no-store',
    },
  });
}

