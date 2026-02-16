import { rollbackVersion } from '@/server/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  return withApiErrorHandling(async () => {
    const { versionId } = await params;
    const result = await rollbackVersion({ versionId });
    if (!result.ok) {
      const status =
        result.error === 'policy_failed'
          ? 403
          : result.error === 'Version not found'
            ? 404
            : 400;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}
