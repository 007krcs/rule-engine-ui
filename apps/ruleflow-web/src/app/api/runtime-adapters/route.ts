import { getRuntimeAdapters } from '@/server/repository';
import { noStoreJson, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const url = new URL(request.url);
    const env = url.searchParams.get('env') ?? undefined;
    const versionId = url.searchParams.get('versionId') ?? undefined;
    const packageId = url.searchParams.get('packageId') ?? undefined;

    const result = await getRuntimeAdapters({
      env,
      versionId,
      packageId,
    });

    return noStoreJson(result);
  });
}
