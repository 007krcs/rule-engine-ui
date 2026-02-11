import { requestChanges } from '@/server/demo/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ approvalId: string }> }) {
  return withApiErrorHandling(async () => {
    const { approvalId } = await params;
    const body = (await request.json().catch(() => null)) as null | { notes?: string };
    const result = await requestChanges({ approvalId, notes: body?.notes });
    if (!result.ok) {
      return noStoreJson(result, 404);
    }
    return noStoreJson(result);
  });
}
