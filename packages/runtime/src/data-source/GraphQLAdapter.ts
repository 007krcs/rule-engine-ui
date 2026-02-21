import type { DataSourceAdapter, DispatchRequest, RequestResiliencePolicy } from './DataSourceAdapter';
import { RestAdapter } from './RestAdapter';
import { executeWithResilience } from './resilience';
import { applySafeTransform } from './safe-transform';

export class GraphQLAdapter implements DataSourceAdapter {
  constructor(
    private readonly endpoint: string,
    private readonly defaultQuery?: string,
    private readonly init?: RequestInit,
    private readonly resilience?: RequestResiliencePolicy,
  ) {}

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async fetch(query: DispatchRequest): Promise<any> {
    const endpoint = typeof query?.endpoint === 'string' ? query.endpoint : this.endpoint;
    const gqlQuery = typeof query?.query === 'string' ? query.query : this.defaultQuery;
    if (!gqlQuery) {
      throw new Error('GraphQLAdapter requires a query string.');
    }

    const action = toGraphQLInternalAction(gqlQuery, query);
    try {
      const response = await executeWithResilience(
        `graphql:${endpoint}:${action.operationType}:${action.operationName ?? 'anonymous'}`,
        () =>
          fetch(endpoint, {
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
          }),
        query?.resilience ?? this.resilience,
      );

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
      return applySafeTransform(payload.data, {
        template: query?.transformTemplate,
        selector: query?.selector,
      });
    } catch (error) {
      if (query?.fallback?.type !== 'rest') throw error;
      const fallback = new RestAdapter(query.fallback.endpoint, this.init, query?.resilience ?? this.resilience);
      return fallback.fetch({
        method: query.fallback.method ?? 'POST',
        payload: query?.variables,
        body: query?.variables,
        headers: query?.headers,
        responseType: query?.responseType,
        xmlMapper: query?.xmlMapper,
        binaryMapper: query?.binaryMapper,
        transformTemplate: query?.transformTemplate,
        selector: query?.selector,
      });
    }
  }

  async dispatch(request: DispatchRequest): Promise<unknown> {
    return this.fetch(request);
  }
}

function toGraphQLInternalAction(
  query: string,
  request: DispatchRequest,
): {
  type: 'graphql.execute';
  operationType: 'query' | 'mutation' | 'subscription';
  operationName?: string;
  variables: Record<string, unknown>;
} {
  const normalized = query.trim().toLowerCase();
  const operationType = normalized.startsWith('mutation')
    ? 'mutation'
    : normalized.startsWith('subscription')
      ? 'subscription'
      : 'query';
  return {
    type: 'graphql.execute',
    operationType,
    operationName: request.operationName,
    variables: request.variables ?? {},
  };
}
