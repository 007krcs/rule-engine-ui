import type { DataSourceAdapter, DispatchRequest, RequestResiliencePolicy } from './DataSourceAdapter';
import type { KafkaClient } from './connectors/KafkaConnector';
import { KafkaConnector } from './connectors/KafkaConnector';
import { executeWithResilience } from './resilience';
import { applySafeTransform } from './safe-transform';

export class KafkaAdapter implements DataSourceAdapter {
  private readonly connector: KafkaConnector;

  constructor(
    client: KafkaClient,
    private readonly resilience?: RequestResiliencePolicy,
  ) {
    this.connector = new KafkaConnector(client);
  }

  connect(): Promise<void> {
    return this.connector.connect();
  }

  async fetch(query: DispatchRequest): Promise<any> {
    return this.dispatch({
      topic: query.topic ?? 'default',
      payload: query.payload ?? query,
      headers: query.headers,
      transformTemplate: query.transformTemplate,
      selector: query.selector,
      resilience: query.resilience,
    });
  }

  async dispatch(request: DispatchRequest): Promise<unknown> {
    const topic = request.topic ?? 'default';
    const output = await executeWithResilience(
      `kafka:dispatch:${topic}`,
      () =>
        this.connector.dispatch({
          topic,
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
