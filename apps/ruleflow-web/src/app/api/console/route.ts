import { getConsoleSnapshot } from '@/server/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET() {
  return withApiErrorHandling(async () => {
    const snapshot = await getConsoleSnapshot();
    return noStoreJson(snapshot);
  });
}

