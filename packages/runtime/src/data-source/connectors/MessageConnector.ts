export interface MessageConnector {
  connect(): Promise<void>;
  disconnect?(): Promise<void>;
  dispatch(input: {
    topic: string;
    payload: unknown;
    headers?: Record<string, string>;
  }): Promise<unknown>;
  subscribe?(topic: string, handler: (payload: unknown) => void): void;
}
