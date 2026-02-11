export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as unknown;
    if (data && typeof data === 'object') {
      const rec = data as { error?: unknown; issues?: unknown };
      const error = rec.error;
      if (typeof error === 'string') {
        const issues = rec.issues;
        if (Array.isArray(issues) && issues.length > 0) {
          const first = issues[0] as { path?: unknown; message?: unknown };
          const path = typeof first?.path === 'string' ? first.path : 'root';
          const message = typeof first?.message === 'string' ? first.message : 'invalid';
          const suffix = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';
          return `${error}: ${path}: ${message}${suffix}`;
        }
        return error;
      }
    }
  } catch {
    // ignore
  }
  return `${response.status} ${response.statusText}`.trim();
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
