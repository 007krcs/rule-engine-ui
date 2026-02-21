import type { DataSourceAdapter } from './DataSourceAdapter';

export class GraphQLAdapter implements DataSourceAdapter {
  constructor(
    private readonly endpoint: string,
    private readonly defaultQuery?: string,
    private readonly init?: RequestInit,
  ) {}

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async fetch(query: any): Promise<any> {
    const endpoint = typeof query?.endpoint === 'string' ? query.endpoint : this.endpoint;
    const gqlQuery = typeof query?.query === 'string' ? query.query : this.defaultQuery;
    if (!gqlQuery) {
      throw new Error('GraphQLAdapter requires a query string.');
    }

    const response = await fetch(endpoint, {
      ...this.init,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.init?.headers ?? {}),
        ...(query?.headers ?? {}),
      },
      body: JSON.stringify({
        query: gqlQuery,
        variables: query?.variables ?? {},
        operationName: query?.operationName,
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL data source request failed (${response.status}) for ${endpoint}`);
    }

    const payload = (await response.json()) as {
      data?: unknown;
      errors?: Array<{ message?: string }>;
    };

    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      const message = payload.errors.map((error) => error.message ?? 'Unknown GraphQL error').join('; ');
      throw new Error(message);
    }
    return payload.data;
  }
}
