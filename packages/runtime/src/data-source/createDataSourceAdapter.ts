import type { ComponentDataSourceConfig, DataSourceAdapter } from './DataSourceAdapter';
import { GrpcAdapter } from './GrpcAdapter';
import { GraphQLAdapter } from './GraphQLAdapter';
import { KafkaAdapter } from './KafkaAdapter';
import { RestAdapter } from './RestAdapter';
import { WebSocketAdapter } from './WebSocketAdapter';
import type { KafkaClient } from './connectors/KafkaConnector';
import type { GrpcClient } from './connectors/GrpcConnector';

export interface DataSourceFactoryDependencies {
  kafkaClient?: KafkaClient;
  grpcClient?: GrpcClient;
}

export function createDataSourceAdapter(
  config: ComponentDataSourceConfig,
  dependencies: DataSourceFactoryDependencies = {},
): DataSourceAdapter {
  switch (config.type) {
    case 'rest':
      return new RestAdapter(config.endpoint, undefined, config.resilience);
    case 'graphql':
      return new GraphQLAdapter(config.endpoint, config.query, undefined, config.resilience);
    case 'websocket':
      return new WebSocketAdapter(config.endpoint, config.resilience);
    case 'kafka':
      if (!dependencies.kafkaClient) {
        throw new Error('Kafka client dependency is required for kafka data source.');
      }
      return new KafkaAdapter(dependencies.kafkaClient, config.resilience);
    case 'grpc':
      if (!dependencies.grpcClient) {
        throw new Error('gRPC client dependency is required for grpc data source.');
      }
      return new GrpcAdapter(dependencies.grpcClient, config.resilience);
    default:
      throw new Error(`Unsupported data source type: ${String((config as { type?: unknown }).type)}`);
  }
}
