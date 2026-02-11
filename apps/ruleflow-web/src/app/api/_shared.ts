import { NextResponse } from 'next/server';
import { getStoreDiagnostics, isPersistenceError } from '@/server/demo/repository';

export const PERSISTENCE_UNAVAILABLE_MESSAGE = 'Persistence unavailable, check store provider';

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
    return await handler();
  } catch (error) {
    const diagnostics = await getStoreDiagnostics().catch(() => null);

    if (isPersistenceError(error)) {
      return noStoreJson(
        {
          ok: false,
          error: PERSISTENCE_UNAVAILABLE_MESSAGE,
          diagnostics,
        },
        503,
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
