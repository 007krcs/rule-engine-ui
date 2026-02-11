import { approveRequest } from '@/server/demo/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ approvalId: string }> }) {
  return withApiErrorHandling(async () => {
    const { approvalId } = await params;
    const result = await approveRequest({ approvalId });
    if (!result.ok) {
      return noStoreJson(result, 404);
    }
    return noStoreJson(result);
  });
}
