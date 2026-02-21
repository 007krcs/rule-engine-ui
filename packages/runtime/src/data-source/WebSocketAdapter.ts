import type { DataSourceAdapter } from './DataSourceAdapter';

type TopicHandler = (payload: unknown) => void;

type SocketPoolEntry = {
  socket: WebSocket | null;
  connecting: Promise<void> | null;
  refs: number;
  handlers: Map<string, Set<TopicHandler>>;
  pending: Map<string, (value: unknown) => void>;
};

export class WebSocketAdapter implements DataSourceAdapter {
  private static readonly pools = new Map<string, SocketPoolEntry>();

  constructor(private readonly endpoint: string) {
    const pool = WebSocketAdapter.pools.get(endpoint);
    if (pool) {
      pool.refs += 1;
      return;
    }
    WebSocketAdapter.pools.set(endpoint, {
      socket: null,
      connecting: null,
      refs: 1,
      handlers: new Map<string, Set<TopicHandler>>(),
      pending: new Map<string, (value: unknown) => void>(),
    });
  }

  async connect(): Promise<void> {
    const pool = this.getPool();
    if (pool.socket && pool.socket.readyState === WebSocket.OPEN) return;
    if (pool.connecting) {
      await pool.connecting;
      return;
    }
    if (typeof WebSocket === 'undefined') {
      throw new Error('WebSocket is not available in this environment.');
    }

    pool.connecting = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.endpoint);
      socket.onopen = () => {
        pool.socket = socket;
        resolve();
      };
      socket.onerror = () => reject(new Error(`WebSocket connection failed for ${this.endpoint}`));
      socket.onmessage = (event) => {
        const payload = safeParseJson(event.data);
        this.handleMessage(pool, payload);
      };
      socket.onclose = () => {
        pool.socket = null;
      };
    });

    try {
      await pool.connecting;
    } finally {
      pool.connecting = null;
    }
  }

  async fetch(query: any): Promise<any> {
    await this.connect();
    const pool = this.getPool();
    const socket = pool.socket;
    if (!socket) {
      throw new Error('WebSocket connection is not available.');
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const topic = typeof query?.topic === 'string' ? query.topic : 'default';
    const request = { id, type: 'request', topic, query };

    return new Promise((resolve) => {
      pool.pending.set(id, resolve);
      socket.send(JSON.stringify(request));
    });
  }

  subscribe(topic: string, handler: Function): void {
    const pool = this.getPool();
    const listeners = pool.handlers.get(topic) ?? new Set<TopicHandler>();
    listeners.add(handler as TopicHandler);
    pool.handlers.set(topic, listeners);
  }

  private getPool(): SocketPoolEntry {
    const pool = WebSocketAdapter.pools.get(this.endpoint);
    if (!pool) {
      throw new Error(`Missing WebSocket pool for endpoint ${this.endpoint}`);
    }
    return pool;
  }

  private handleMessage(pool: SocketPoolEntry, payload: unknown): void {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
    const record = payload as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : undefined;
    const topic = typeof record.topic === 'string' ? record.topic : undefined;
    const data = record.data;

    if (id && pool.pending.has(id)) {
      const resolve = pool.pending.get(id);
      pool.pending.delete(id);
      resolve?.(data);
    }

    if (!topic) return;
    const listeners = pool.handlers.get(topic);
    listeners?.forEach((listener) => listener(data));
  }
}

function safeParseJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
