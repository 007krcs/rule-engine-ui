import { getStoreDiagnostics } from '@/server/demo/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET() {
  return withApiErrorHandling(async () => {
    const store = await getStoreDiagnostics();

    return noStoreJson({
      ok: true,
      checkedAt: new Date().toISOString(),
      canWriteToStore: store.canWriteToStore,
      store,
    });
  });
}
