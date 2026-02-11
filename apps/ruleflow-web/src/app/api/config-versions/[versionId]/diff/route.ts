import { diffVersion } from '@/server/demo/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  return withApiErrorHandling(async () => {
    const { versionId } = await params;
    const url = new URL(request.url);
    const against = url.searchParams.get('against');

    const result = await diffVersion({ versionId, againstVersionId: against });
    if (!result.ok) {
      return noStoreJson(result, 404);
    }
    return noStoreJson(result);
  });
}
