import { NextResponse } from 'next/server';
import { importGitOpsBundle } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  let bundle: unknown;

  if (contentType.includes('application/json')) {
    bundle = await request.json().catch(() => null);
  } else if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
    }
    const text = await file.text();
    bundle = JSON.parse(text);
  } else {
    return NextResponse.json({ ok: false, error: 'unsupported content-type' }, { status: 415 });
  }

  if (!bundle || typeof bundle !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid bundle' }, { status: 400 });
  }

  const result = await importGitOpsBundle({ bundle: bundle as any });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}

