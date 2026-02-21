import type { MessageConnector } from './MessageConnector';

export interface KafkaClient {
  connect(): Promise<void>;
  publish(topic: string, payload: unknown, headers?: Record<string, string>): Promise<unknown>;
  subscribe?(topic: string, handler: (payload: unknown) => void): void;
}

export class KafkaConnector implements MessageConnector {
  constructor(private readonly client: KafkaClient) {}

  connect(): Promise<void> {
    return this.client.connect();
  }

  dispatch(input: { topic: string; payload: unknown; headers?: Record<string, string> }): Promise<unknown> {
    return this.client.publish(input.topic, input.payload, input.headers);
  }

  subscribe(topic: string, handler: (payload: unknown) => void): void {
    this.client.subscribe?.(topic, handler);
  }
}
