import type { JsonRecord } from '@platform/persistence-postgres';
import { listExecutionTraces, recordExecutionTrace } from '@/server/repository';
import { noStoreJson, requirePolicy, withApiErrorHandling } from '@/app/api/_shared';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const result = await listExecutionTraces({ limit: Number.isFinite(limit) ? limit : 100 });
    return noStoreJson(result);
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const blocked = await requirePolicy({
      stage: 'save',
      requiredRole: 'Author',
      metadata: { route: 'execution-traces.record' },
    });
    if (blocked) {
      return blocked;
    }

    const body = (await request.json().catch(() => null)) as null | {
      executionId?: string;
      correlationId?: string;
      packageId?: string;
      versionId?: string;
      trace?: JsonRecord;
      coldStorageUri?: string;
    };
    if (!body || typeof body.executionId !== 'string' || typeof body.correlationId !== 'string' || !body.trace) {
      return noStoreJson({ ok: false, error: 'executionId, correlationId, trace are required' }, 400);
    }
    const result = await recordExecutionTrace({
      executionId: body.executionId,
      correlationId: body.correlationId,
      packageId: body.packageId,
      versionId: body.versionId,
      trace: body.trace,
      coldStorageUri: body.coldStorageUri,
    });
    return noStoreJson(result);
  });
}
