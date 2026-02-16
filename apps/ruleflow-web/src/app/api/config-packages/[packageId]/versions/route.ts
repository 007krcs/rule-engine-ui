import { createConfigVersion } from '@/server/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ packageId: string }> },
) {
  return withApiErrorHandling(async () => {
    const { packageId } = await params;
    const body = (await request.json().catch(() => null)) as null | {
      fromVersionId?: string;
    };

    const result = await createConfigVersion({
      packageId,
      fromVersionId: body?.fromVersionId,
    });

    if (!result.ok) {
      const status = result.error === 'policy_failed' ? 403 : 400;
      return noStoreJson(result, status);
    }

    return noStoreJson(result);
  });
}
