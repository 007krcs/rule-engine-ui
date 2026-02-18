import { submitForReview } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  return withApiErrorHandling(async () => {
    const { versionId } = await params;
    const blocked = await requirePolicy({
      stage: 'submit-for-review',
      requiredRole: 'Author',
      metadata: { route: 'config-versions.submit-review', versionId },
    });
    if (blocked) {
      return blocked;
    }

    const body = (await request.json().catch(() => null)) as null | { scope?: string; risk?: string };
    const scope = body?.scope?.trim();
    const risk = body?.risk;

    if (!scope || !risk) {
      return noStoreJson({ ok: false, error: 'scope and risk are required' }, 400);
    }
    if (risk !== 'Low' && risk !== 'Medium' && risk !== 'High') {
      return noStoreJson({ ok: false, error: 'risk must be Low|Medium|High' }, 400);
    }

    const result = await submitForReview({ versionId, scope, risk });
    if (!result.ok) {
      const status =
        result.error === 'Version not found'
          ? 404
          : result.error === 'policy_failed'
            ? 403
            : result.error === 'version_killed'
              ? 409
              : 400;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}


