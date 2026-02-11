import { promoteVersion } from '@/server/demo/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  return withApiErrorHandling(async () => {
    const { versionId } = await params;
    const result = await promoteVersion({ versionId });
    if (!result.ok) {
      return noStoreJson(result, 400);
    }
    return noStoreJson(result);
  });
}
