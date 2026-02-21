export interface RetryPolicy {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
}

export interface CircuitBreakerPolicy {
  failureThreshold?: number;
  cooldownMs?: number;
}

export interface RequestResiliencePolicy {
  retry?: RetryPolicy;
  circuitBreaker?: CircuitBreakerPolicy;
  timeoutMs?: number;
}

export interface ResponseMappingConfig<TInput = unknown, TOutput = unknown> {
  mapResponse?: (input: TInput) => TOutput;
  mapError?: (error: unknown) => unknown;
}

export interface DispatchRequest {
  topic?: string;
  method?: string;
  endpoint?: string;
  payload?: unknown;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
  responseType?: 'json' | 'text' | 'xml' | 'binary';
  xmlMapper?: (xml: string) => unknown;
  binaryMapper?: (data: Uint8Array) => unknown;
  transformTemplate?: string;
  selector?: string;
  fallback?: {
    type: 'rest';
    endpoint: string;
    method?: string;
  };
  resilience?: RequestResiliencePolicy;
}

export interface DataSourceAdapter {
  connect(): Promise<void>;
  fetch(query: any): Promise<any>;
  subscribe?(topic: string, handler: Function): void;
  dispatch?(request: DispatchRequest): Promise<unknown>;
}

export type DataSourceType = 'rest' | 'graphql' | 'websocket' | 'kafka' | 'grpc';

export interface ComponentDataSourceConfig {
  type: DataSourceType;
  endpoint: string;
  query?: string;
  resilience?: RequestResiliencePolicy;
}
