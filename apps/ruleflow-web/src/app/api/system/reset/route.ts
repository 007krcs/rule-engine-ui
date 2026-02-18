import { resetDemoStore } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST() {
  return withApiErrorHandling(async () => {
    const blocked = await requirePolicy({
      stage: 'promote',
      requiredRole: 'Publisher',
      metadata: { route: 'system.reset' },
    });
    if (blocked) {
      return blocked;
    }

    const result = await resetDemoStore();
    return noStoreJson(result);
  });
}

