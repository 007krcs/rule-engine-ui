import { NextResponse } from 'next/server';
import { resetDemoStore } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function POST() {
  const result = await resetDemoStore();
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}

