import path from 'node:path';
import { DemoFileDalAdapter } from './adapters/DemoFileDalAdapter';
import { InMemoryDalAdapter } from './adapters/InMemoryDalAdapter';
import { MongoDalAdapter } from './adapters/MongoDalAdapter';
import { PostgresDalAdapter } from './adapters/PostgresDalAdapter';
import type { PersistenceDal } from './types';

export type PersistenceProvider = 'memory' | 'demo-file' | 'mongodb' | 'postgres';

export async function createPersistenceDal(input: {
  provider: PersistenceProvider;
  mongoUri?: string;
  mongoDbName?: string;
  baseDir?: string;
  postgresConnectionString?: string;
}): Promise<PersistenceDal> {
  if (input.provider === 'memory') {
    return new InMemoryDalAdapter();
  }
  if (input.provider === 'demo-file') {
    return new DemoFileDalAdapter(input.baseDir ?? path.join(process.cwd(), '.ruleflow-demo-data'));
  }
  if (input.provider === 'mongodb') {
    if (!input.mongoUri) {
      throw new Error('mongoUri is required for mongodb provider');
    }
    return new MongoDalAdapter({ uri: input.mongoUri, dbName: input.mongoDbName });
  }
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<unknown>;
  const mod = (await dynamicImport('@platform/persistence-postgres')) as {
    PostgresTenantRepository: {
      create(input: { connectionString?: string; runMigrationsOnBoot?: boolean }): Promise<unknown>;
    };
  };
  const repo = (await mod.PostgresTenantRepository.create({
    connectionString: input.postgresConnectionString,
    runMigrationsOnBoot: true,
  })) as ConstructorParameters<typeof PostgresDalAdapter>[0];
  return new PostgresDalAdapter(repo);
}
