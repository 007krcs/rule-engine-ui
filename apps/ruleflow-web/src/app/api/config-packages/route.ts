import { NextResponse } from 'next/server';
import { createConfigPackage } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as null | { name?: string; description?: string };
  if (!body || typeof body.name !== 'string') {
    return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
  }

  const result = await createConfigPackage({ name: body.name, description: body.description });
  return NextResponse.json({ ok: true, ...result }, { headers: { 'cache-control': 'no-store' } });
}

