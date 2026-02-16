export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const STORE_WRITE_FAILED_MESSAGE = 'Store write failed';
const PERSISTENCE_HINT = 'Persistence unavailable, check store provider';

function withPersistenceHint(message: string, status: number): string {
  if (status >= 500 && !message.toLowerCase().includes(PERSISTENCE_HINT.toLowerCase())) {
    return `${message}. ${PERSISTENCE_HINT}`;
  }
  return message;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as unknown;
    if (data && typeof data === 'object') {
      const rec = data as { error?: unknown; issues?: unknown; policyErrors?: unknown; diagnostics?: unknown };
      const error = rec.error;
      if (typeof error === 'string') {
        const policyErrors = rec.policyErrors;
        if (Array.isArray(policyErrors) && policyErrors.length > 0) {
          const first = policyErrors[0] as { code?: unknown; message?: unknown; hint?: unknown };
          const code = typeof first.code === 'string' ? first.code : 'policy';
          const message = typeof first.message === 'string' ? first.message : 'Policy check failed';
          const hint = typeof first.hint === 'string' ? ` (${first.hint})` : '';
          const suffix = policyErrors.length > 1 ? ` (+${policyErrors.length - 1} more)` : '';
          return withPersistenceHint(`${error}: ${code}: ${message}${hint}${suffix}`, response.status);
        }

        const issues = rec.issues;
        if (Array.isArray(issues) && issues.length > 0) {
          const first = issues[0] as { path?: unknown; message?: unknown };
          const path = typeof first?.path === 'string' ? first.path : 'root';
          const message = typeof first?.message === 'string' ? first.message : 'invalid';
          const suffix = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';
          return withPersistenceHint(`${error}: ${path}: ${message}${suffix}`, response.status);
        }

        if (error === STORE_WRITE_FAILED_MESSAGE && rec.diagnostics && typeof rec.diagnostics === 'object') {
          const provider = (rec.diagnostics as { provider?: unknown }).provider;
          if (typeof provider === 'string') {
            return `${error} (provider: ${provider})`;
          }
        }

        return withPersistenceHint(error, response.status);
      }
    }
  } catch {
    // ignore
  }
  return withPersistenceHint(`${response.status} ${response.statusText}`.trim(), response.status);
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: 'GET', headers: { 'cache-control': 'no-store' } });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return (await response.json()) as T;
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return (await response.json()) as T;
}

export async function downloadFromApi(url: string, fallbackFilename: string): Promise<void> {
  // Trigger the download via a direct navigation so browsers treat it as user-initiated.
  // (Fetching + blob URLs can be blocked when awaited inside async click handlers.)
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fallbackFilename;
  anchor.rel = 'noopener';
  anchor.click();
}
