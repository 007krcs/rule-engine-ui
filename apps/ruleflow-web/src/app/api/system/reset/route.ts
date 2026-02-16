import { resetDemoStore } from '@/server/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function POST() {
  return withApiErrorHandling(async () => {
    const result = await resetDemoStore();
    return noStoreJson(result);
  });
}

