import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphQLAdapter } from '../src/data-source/GraphQLAdapter';
import { InMemoryAdapter } from '../src/data-source/InMemoryAdapter';
import { RestAdapter } from '../src/data-source/RestAdapter';
import { createDataSourceAdapter } from '../src/data-source/createDataSourceAdapter';

describe('data-source adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rest adapter fetches JSON payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
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

  it('in-memory adapter returns seeded values and supports pubsub', async () => {
    const adapter = new InMemoryAdapter({ orders: [{ id: 'o-1' }] });
    const handler = vi.fn();
    adapter.subscribe('orders', handler);

    const result = await adapter.fetch('orders');
    adapter.publish('orders', { id: 'o-2' });

    expect(result).toEqual([{ id: 'o-1' }]);
    expect(handler).toHaveBeenCalledWith({ id: 'o-2' });
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
});
