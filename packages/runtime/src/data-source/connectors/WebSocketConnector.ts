import type { MessageConnector } from './MessageConnector';

type TopicHandler = (payload: unknown) => void;

type SocketPoolEntry = {
  socket: WebSocket | null;
  connecting: Promise<void> | null;
  handlers: Map<string, Set<TopicHandler>>;
  pending: Map<string, (value: unknown) => void>;
  refs: number;
};

export class WebSocketConnector implements MessageConnector {
  private static readonly pools = new Map<string, SocketPoolEntry>();

  constructor(private readonly endpoint: string) {
    const existing = WebSocketConnector.pools.get(endpoint);
    if (existing) {
      existing.refs += 1;
      return;
    }
    WebSocketConnector.pools.set(endpoint, {
      socket: null,
      connecting: null,
      handlers: new Map<string, Set<TopicHandler>>(),
      pending: new Map<string, (value: unknown) => void>(),
      refs: 1,
    });
  }

  async connect(): Promise<void> {
    const pool = this.getPool();
    if (pool.socket && pool.socket.readyState === WebSocket.OPEN) return;
    if (pool.connecting) return pool.connecting;
    if (typeof WebSocket === 'undefined') throw new Error('WebSocket is not available in this environment.');

    pool.connecting = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.endpoint);
      socket.onopen = () => {
        pool.socket = socket;
        resolve();
      };
      socket.onerror = () => reject(new Error(`WebSocket connection failed for ${this.endpoint}`));
      socket.onmessage = (event) => {
        const payload = safeParseJson(event.data);
        this.handlePayload(pool, payload);
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

  async dispatch(input: { topic: string; payload: unknown; headers?: Record<string, string> }): Promise<unknown> {
    await this.connect();
    const pool = this.getPool();
    const socket = pool.socket;
    if (!socket) throw new Error('WebSocket connection unavailable.');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const outbound = {
      id,
      type: 'request',
      topic: input.topic,
      headers: input.headers ?? {},
      data: input.payload,
    };
    return new Promise((resolve) => {
      pool.pending.set(id, resolve);
      socket.send(JSON.stringify(outbound));
    });
  }

  subscribe(topic: string, handler: (payload: unknown) => void): void {
    const pool = this.getPool();
    const listeners = pool.handlers.get(topic) ?? new Set<TopicHandler>();
    listeners.add(handler);
    pool.handlers.set(topic, listeners);
  }

  async disconnect(): Promise<void> {
    const pool = this.getPool();
    pool.refs = Math.max(0, pool.refs - 1);
    if (pool.refs > 0) return;
    pool.socket?.close();
    WebSocketConnector.pools.delete(this.endpoint);
  }

  private getPool(): SocketPoolEntry {
    const pool = WebSocketConnector.pools.get(this.endpoint);
    if (!pool) throw new Error(`Missing websocket pool for ${this.endpoint}`);
    return pool;
  }

  private handlePayload(pool: SocketPoolEntry, payload: unknown): void {
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
    pool.handlers.get(topic)?.forEach((listener) => listener(data));
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
