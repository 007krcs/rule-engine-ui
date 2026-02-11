import { NextResponse } from 'next/server';
import { getConfigStore, getStoreDiagnostics, isPersistenceError } from '@/server/demo/repository';

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
  try {
    await getConfigStore();
    return await handler();
  } catch (error) {
    const diagnostics = await getStoreDiagnostics().catch(() => null);

    if (isPersistenceError(error)) {
      return noStoreJson(
        {
          ok: false,
          error: STORE_WRITE_FAILED_MESSAGE,
          diagnostics,
        },
        500,
      );
    }

    const message = error instanceof Error ? error.message : String(error);

    return noStoreJson(
      {
        ok: false,
        error: message,
        diagnostics,
      },
      500,
    );
  }
}
