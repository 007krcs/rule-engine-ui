import type { GitOpsBundle } from '@/lib/demo/types';
import { importGitOpsBundle } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const blocked = await requirePolicy({
      stage: 'promote',
      requiredRole: 'Publisher',
      metadata: { route: 'gitops.import' },
    });
    if (blocked) {
      return blocked;
    }

    const contentType = request.headers.get('content-type') ?? '';
    let bundle: unknown;

    if (contentType.includes('application/json')) {
      bundle = await request.json().catch(() => null);
      if (!bundle) {
        return noStoreJson({ ok: false, error: 'invalid JSON body' }, 400);
      }
    } else if (contentType.includes('multipart/form-data')) {
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return noStoreJson({ ok: false, error: 'invalid multipart form data' }, 400);
      }
      const file = form.get('file');
      if (!file || !(file instanceof File)) {
        return noStoreJson({ ok: false, error: 'file is required' }, 400);
      }
      const text = await file.text();
      try {
        bundle = JSON.parse(text);
      } catch {
        return noStoreJson({ ok: false, error: 'invalid JSON file' }, 400);
      }
    } else {
      return noStoreJson({ ok: false, error: 'unsupported content-type' }, 415);
    }

    if (!bundle || typeof bundle !== 'object') {
      return noStoreJson({ ok: false, error: 'invalid bundle' }, 400);
    }

    const result = await importGitOpsBundle({ bundle: bundle as GitOpsBundle });
    if (!result.ok) {
      const status = result.error === 'policy_failed' ? 403 : 400;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}

