import type { ComponentDataSourceConfig, DataSourceAdapter } from './DataSourceAdapter';
import { GraphQLAdapter } from './GraphQLAdapter';
import { RestAdapter } from './RestAdapter';
import { WebSocketAdapter } from './WebSocketAdapter';

export function createDataSourceAdapter(config: ComponentDataSourceConfig): DataSourceAdapter {
  switch (config.type) {
    case 'rest':
      return new RestAdapter(config.endpoint);
    case 'graphql':
      return new GraphQLAdapter(config.endpoint, config.query);
    case 'websocket':
      return new WebSocketAdapter(config.endpoint);
    default:
      throw new Error(`Unsupported data source type: ${String((config as { type?: unknown }).type)}`);
  }
}
