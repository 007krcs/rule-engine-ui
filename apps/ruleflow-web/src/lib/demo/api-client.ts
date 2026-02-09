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
      const error = (data as { error?: unknown }).error;
      if (typeof error === 'string') return error;
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
  const response = await fetch(url, { method: 'GET', headers: { 'cache-control': 'no-store' } });
  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = (match?.[1] ?? fallbackFilename).replace(/[\\/:*?"<>|]+/g, '-');

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
