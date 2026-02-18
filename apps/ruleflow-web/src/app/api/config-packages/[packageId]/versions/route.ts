import { createConfigVersion } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ packageId: string }> },
) {
  return withApiErrorHandling(async () => {
    const { packageId } = await params;
    const blocked = await requirePolicy({
      stage: 'save',
      requiredRole: 'Author',
      metadata: { route: 'config-versions.create', packageId },
    });
    if (blocked) {
      return blocked;
    }

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
