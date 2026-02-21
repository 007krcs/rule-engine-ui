import type { DataSourceAdapter, DispatchRequest, RequestResiliencePolicy } from './DataSourceAdapter';
import { executeWithResilience } from './resilience';
import { parseResponseByType } from './response-parsers';
import { applySafeTransform } from './safe-transform';

export class RestAdapter implements DataSourceAdapter {
  constructor(
    private readonly endpoint: string,
    private readonly init?: RequestInit,
    private readonly resilience?: RequestResiliencePolicy,
  ) {}

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async fetch(query: DispatchRequest): Promise<any> {
    const endpoint = typeof query?.endpoint === 'string' ? query.endpoint : this.endpoint;
    const method = typeof query?.method === 'string' ? query.method.toUpperCase() : 'GET';
    const headers = {
      'content-type': 'application/json',
      ...(this.init?.headers ?? {}),
      ...(query?.headers ?? {}),
    } as HeadersInit;

    const targetUrl = buildRestUrl(endpoint, query?.params);
    const requestInit: RequestInit = {
      ...this.init,
      method,
      headers,
      body:
        method === 'GET' || method === 'HEAD'
          ? undefined
          : query?.body !== undefined || query?.payload !== undefined
            ? JSON.stringify(query.body ?? query.payload)
            : undefined,
    };

    const response = await executeWithResilience(
      `rest:${endpoint}:${method}`,
      () => fetch(targetUrl, requestInit),
      query?.resilience ?? this.resilience,
    );
    if (!response.ok) throw new Error(`REST data source request failed (${response.status}) for ${targetUrl}`);
    const parsed = await parseResponseByType(response, query);
    return applySafeTransform(parsed, {
      template: query?.transformTemplate,
      selector: query?.selector,
    });
  }

  async dispatch(request: DispatchRequest): Promise<unknown> {
    return this.fetch(request);
  }
}

function buildRestUrl(endpoint: string, params: unknown): string {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return endpoint;
  const url = new URL(endpoint, endpoint.startsWith('http') ? undefined : 'http://localhost');
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
  return endpoint.startsWith('http') ? url.toString() : `${url.pathname}${url.search}`;
}
