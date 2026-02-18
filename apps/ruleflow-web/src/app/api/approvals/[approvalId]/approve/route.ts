import { approveRequest } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ approvalId: string }> }) {
  return withApiErrorHandling(async () => {
    const { approvalId } = await params;
    const blocked = await requirePolicy({
      stage: 'approve',
      requiredRole: 'Approver',
      metadata: { route: 'approvals.approve', approvalId },
    });
    if (blocked) {
      return blocked;
    }

    const result = await approveRequest({ approvalId });
    if (!result.ok) {
      const status = result.error === 'policy_failed' ? 403 : 404;
      return noStoreJson(result, status);
    }
    return noStoreJson(result);
  });
}



