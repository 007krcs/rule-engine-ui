import { promoteVersion } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  return withApiErrorHandling(async () => {
    const { versionId } = await params;
    const blocked = await requirePolicy({
      stage: 'promote',
      requiredRole: 'Publisher',
      metadata: { route: 'config-versions.promote', versionId },
    });
    if (blocked) {
      return blocked;
    }

    const result = await promoteVersion({ versionId });
    if (!result.ok) {
      const status =
        result.error === 'policy_failed'
          ? 403
          : result.error === 'version_killed'
            ? 409
          : result.error === 'Version not found'
            ? 404
            : 400;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}



