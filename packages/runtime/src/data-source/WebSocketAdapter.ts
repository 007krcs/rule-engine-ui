import type { DataSourceAdapter, DispatchRequest, RequestResiliencePolicy } from './DataSourceAdapter';
import { executeWithResilience } from './resilience';
import { applySafeTransform } from './safe-transform';
import { WebSocketConnector } from './connectors/WebSocketConnector';

export class WebSocketAdapter implements DataSourceAdapter {
  private readonly connector: WebSocketConnector;

  constructor(
    private readonly endpoint: string,
    private readonly resilience?: RequestResiliencePolicy,
  ) {
    this.connector = new WebSocketConnector(endpoint);
  }

  async connect(): Promise<void> {
    await executeWithResilience(`websocket:connect:${this.endpoint}`, () => this.connector.connect(), this.resilience);
  }

  async fetch(query: DispatchRequest): Promise<any> {
    return this.dispatch({
      topic: typeof query?.topic === 'string' ? query.topic : 'default',
      payload: query,
      headers: query?.headers,
      transformTemplate: query?.transformTemplate,
      selector: query?.selector,
      resilience: query?.resilience,
    });
  }

  async dispatch(request: DispatchRequest): Promise<unknown> {
    const topic = typeof request.topic === 'string' ? request.topic : 'default';
    const payload = await executeWithResilience(
      `websocket:dispatch:${this.endpoint}:${topic}`,
      () => this.connector.dispatch({
        topic,
        payload: request.payload ?? request,
        headers: request.headers,
      }),
      request?.resilience ?? this.resilience,
    );
    return applySafeTransform(payload, {
      template: request.transformTemplate,
      selector: request.selector,
    });
  }

  subscribe(topic: string, handler: Function): void {
    this.connector.subscribe(topic, handler as (payload: unknown) => void);
  }
}
