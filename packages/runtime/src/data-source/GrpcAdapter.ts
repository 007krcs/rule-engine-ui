import type { DataSourceAdapter, DispatchRequest, RequestResiliencePolicy } from './DataSourceAdapter';
import type { GrpcClient } from './connectors/GrpcConnector';
import { GrpcConnector } from './connectors/GrpcConnector';
import { executeWithResilience } from './resilience';
import { applySafeTransform } from './safe-transform';

export class GrpcAdapter implements DataSourceAdapter {
  private readonly connector: GrpcConnector;

  constructor(
    client: GrpcClient,
    private readonly resilience?: RequestResiliencePolicy,
  ) {
    this.connector = new GrpcConnector(client);
  }

  connect(): Promise<void> {
    return this.connector.connect();
  }

  async fetch(query: DispatchRequest): Promise<any> {
    return this.dispatch({
      topic: query.topic ?? query.method ?? 'default',
      payload: query.payload ?? query,
      headers: query.headers,
      transformTemplate: query.transformTemplate,
      selector: query.selector,
      resilience: query.resilience,
    });
  }

  async dispatch(request: DispatchRequest): Promise<unknown> {
    const method = request.topic ?? request.method ?? 'default';
    const output = await executeWithResilience(
      `grpc:dispatch:${method}`,
      () =>
        this.connector.dispatch({
          topic: method,
          payload: request.payload,
          headers: request.headers,
        }),
      request.resilience ?? this.resilience,
    );
    return applySafeTransform(output, {
      template: request.transformTemplate,
      selector: request.selector,
    });
  }

  subscribe(topic: string, handler: Function): void {
    this.connector.subscribe(topic, handler as (payload: unknown) => void);
  }
}
