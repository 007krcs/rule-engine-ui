import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphQLAdapter } from '../src/data-source/GraphQLAdapter';
import { GrpcAdapter } from '../src/data-source/GrpcAdapter';
import { InMemoryAdapter } from '../src/data-source/InMemoryAdapter';
import { KafkaAdapter } from '../src/data-source/KafkaAdapter';
import { RestAdapter } from '../src/data-source/RestAdapter';
import { createDataSourceAdapter } from '../src/data-source/createDataSourceAdapter';

describe('data-source adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rest adapter fetches JSON payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ rows: [1, 2, 3] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new RestAdapter('https://api.example.com/orders');

    const result = await adapter.fetch({ method: 'GET', params: { status: 'active' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ rows: [1, 2, 3] });
  });

  it('graphql adapter posts query and returns data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { orders: [{ id: 'o-1' }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new GraphQLAdapter('https://api.example.com/graphql', '{ orders { id } }');

    const result = await adapter.fetch({});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ orders: [{ id: 'o-1' }] });
  });

  it('graphql adapter falls back to rest when configured', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ orders: [{ id: 'fallback' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new GraphQLAdapter('https://api.example.com/graphql', 'query Orders { orders { id } }');
    const result = await adapter.fetch({
      fallback: {
        type: 'rest',
        endpoint: 'https://api.example.com/orders',
        method: 'POST',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ orders: [{ id: 'fallback' }] });
  });

  it('supports XML and binary response mapping', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/xml' }),
        text: async () => '<root><order><id>1</id></order></root>',
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new RestAdapter('https://api.example.com/data');
    const xmlResult = await adapter.fetch({
      method: 'GET',
      responseType: 'xml',
      xmlMapper: (xml) => ({ raw: xml.includes('<order>') }),
    });
    const binaryResult = await adapter.fetch({
      method: 'GET',
      responseType: 'binary',
      binaryMapper: (bytes) => Array.from(bytes),
    });

    expect(xmlResult).toEqual({ raw: true });
    expect(binaryResult).toEqual([1, 2, 3]);
  });

  it('applies safe template and selector transforms', async () => {
    const adapter = new InMemoryAdapter({
      orders: [{ id: 'o-1' }],
      customer: { name: 'Ada', tier: 'gold' },
    });

    const selected = await adapter.dispatch?.({ selector: '$.customer.tier' });
    const templated = await adapter.dispatch?.({ transformTemplate: 'Customer {{customer.name}}' });

    expect(selected).toBe('gold');
    expect(templated).toBe('Customer Ada');
  });

  it('retries and eventually succeeds with resilience policy', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ ok: true }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new RestAdapter('https://api.example.com/retry', undefined, {
      retry: { maxRetries: 1, baseDelayMs: 1, jitter: false },
    });

    const result = await adapter.fetch({ method: 'GET' });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('opens circuit breaker after repeated failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new RestAdapter('https://api.example.com/fail', undefined, {
      retry: { maxRetries: 0 },
      circuitBreaker: { failureThreshold: 1, cooldownMs: 10_000 },
    });

    await expect(adapter.fetch({ method: 'GET' })).rejects.toThrow();
    await expect(adapter.fetch({ method: 'GET' })).rejects.toThrow(/Circuit open/);
  });

  it('in-memory adapter returns seeded values and supports pubsub', async () => {
    const adapter = new InMemoryAdapter({ orders: [{ id: 'o-1' }] });
    const handler = vi.fn();
    adapter.subscribe('orders', handler);

    const result = await adapter.fetch('orders');
    adapter.publish('orders', { id: 'o-2' });

    expect(result).toEqual([{ id: 'o-1' }]);
    expect(handler).toHaveBeenCalledWith({ id: 'o-2' });
  });

  it('kafka and grpc adapters dispatch through clients', async () => {
    const kafkaClient = {
      connect: vi.fn(async () => undefined),
      publish: vi.fn(async () => ({ offset: 1 })),
      subscribe: vi.fn(),
    };
    const grpcClient = {
      connect: vi.fn(async () => undefined),
      unary: vi.fn(async () => ({ id: 'resp-1' })),
      stream: vi.fn(),
    };

    const kafka = new KafkaAdapter(kafkaClient);
    const grpc = new GrpcAdapter(grpcClient);

    const kafkaResult = await kafka.dispatch?.({ topic: 'orders', payload: { id: 1 } });
    const grpcResult = await grpc.dispatch?.({ method: 'OrderService/Get', payload: { id: 1 } });

    expect(kafkaResult).toEqual({ offset: 1 });
    expect(grpcResult).toEqual({ id: 'resp-1' });
  });

  it('factory creates correct adapter by type', () => {
    const rest = createDataSourceAdapter({ type: 'rest', endpoint: 'https://api.example.com/orders' });
    const graph = createDataSourceAdapter({
      type: 'graphql',
      endpoint: 'https://api.example.com/graphql',
      query: '{ orders { id } }',
    });
    const socket = createDataSourceAdapter({ type: 'websocket', endpoint: 'wss://api.example.com/live' });

    expect(rest).toBeInstanceOf(RestAdapter);
    expect(graph).toBeInstanceOf(GraphQLAdapter);
    expect(socket.constructor.name).toBe('WebSocketAdapter');
  });

  it('factory creates kafka/grpc when clients are provided', () => {
    const kafkaClient = {
      connect: vi.fn(async () => undefined),
      publish: vi.fn(async () => ({ ok: true })),
    };
    const grpcClient = {
      connect: vi.fn(async () => undefined),
      unary: vi.fn(async () => ({ ok: true })),
    };

    const kafka = createDataSourceAdapter(
      { type: 'kafka', endpoint: 'kafka://cluster-a' },
      { kafkaClient },
    );
    const grpc = createDataSourceAdapter(
      { type: 'grpc', endpoint: 'grpc://order-service' },
      { grpcClient },
    );

    expect(kafka).toBeInstanceOf(KafkaAdapter);
    expect(grpc).toBeInstanceOf(GrpcAdapter);
  });
});
