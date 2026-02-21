export interface DataSourceAdapter {
  connect(): Promise<void>;
  fetch(query: any): Promise<any>;
  subscribe?(topic: string, handler: Function): void;
}

export type DataSourceType = 'rest' | 'graphql' | 'websocket';

export interface ComponentDataSourceConfig {
  type: DataSourceType;
  endpoint: string;
  query?: string;
}
