import { exportGitOpsBundle } from '@/server/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET() {
  return withApiErrorHandling(async () => {
    const bundle = await exportGitOpsBundle();
    const filename = `ruleflow-gitops-${bundle.tenantId}-${bundle.exportedAt.slice(0, 10)}.json`;
    const response = noStoreJson(bundle);
    response.headers.set('content-disposition', `attachment; filename="${filename}"`);
    return response;
  });
}

