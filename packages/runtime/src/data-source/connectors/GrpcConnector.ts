import type { MessageConnector } from './MessageConnector';

export interface GrpcClient {
  connect(): Promise<void>;
  unary(method: string, payload: unknown, metadata?: Record<string, string>): Promise<unknown>;
  stream?(method: string, payload: unknown, onMessage: (value: unknown) => void): void;
}

export class GrpcConnector implements MessageConnector {
  constructor(private readonly client: GrpcClient) {}

  connect(): Promise<void> {
    return this.client.connect();
  }

  dispatch(input: { topic: string; payload: unknown; headers?: Record<string, string> }): Promise<unknown> {
    return this.client.unary(input.topic, input.payload, input.headers);
  }

  subscribe(topic: string, handler: (payload: unknown) => void): void {
    this.client.stream?.(topic, {}, handler);
  }
}
