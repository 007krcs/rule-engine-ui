import { NextResponse } from 'next/server';
import type { GitOpsBundle } from '@/lib/demo/types';
import { importGitOpsBundle } from '@/server/demo/repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  let bundle: unknown;

  if (contentType.includes('application/json')) {
    bundle = await request.json().catch(() => null);
    if (!bundle) {
      return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
    }
  } else if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid multipart form data' }, { status: 400 });
    }
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
    }
    const text = await file.text();
    try {
      bundle = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid JSON file' }, { status: 400 });
    }
  } else {
    return NextResponse.json({ ok: false, error: 'unsupported content-type' }, { status: 415 });
  }

  if (!bundle || typeof bundle !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid bundle' }, { status: 400 });
  }

  const result = await importGitOpsBundle({ bundle: bundle as GitOpsBundle });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
