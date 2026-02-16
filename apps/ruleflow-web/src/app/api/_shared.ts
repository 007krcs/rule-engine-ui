import { NextResponse } from 'next/server';
import { getConfigStore, getStoreDiagnostics, isPersistenceError } from '@/server/repository';
import { recordApiCall } from '@/server/metrics';

export const STORE_WRITE_FAILED_MESSAGE = 'Store write failed';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
};

export function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export async function withApiErrorHandling(handler: () => Promise<NextResponse>) {
  const startedAt = Date.now();
  try {
    await getConfigStore();
    const response = await handler();
    recordApiCall(Date.now() - startedAt, response.status);
    return response;
  } catch (error) {
    const diagnostics = await getStoreDiagnostics().catch(() => null);

    if (isPersistenceError(error)) {
      const response = noStoreJson(
        {
          ok: false,
          error: STORE_WRITE_FAILED_MESSAGE,
          diagnostics,
        },
        500,
      );
      recordApiCall(Date.now() - startedAt, response.status);
      return response;
    }

    const message = error instanceof Error ? error.message : String(error);

    const response = noStoreJson(
      {
        ok: false,
        error: message,
        diagnostics,
      },
      500,
    );
    recordApiCall(Date.now() - startedAt, response.status);
    return response;
  }
}

