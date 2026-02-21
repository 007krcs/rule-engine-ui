import { promises as fs } from 'node:fs';
import { createPersistenceDal } from './createPersistenceDal';
import type {
  ConfigLifecycleStatus,
  DalConfigRecord,
  PersistenceDal,
  TenantContext,
} from './types';

type Provider = 'json' | 'postgres' | 'mongodb';

type Args = {
  from: Provider;
  to: Provider;
  tenantId: string;
  file?: string;
  fromUri?: string;
  toUri?: string;
  mongoDbName?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sourceConfigs = await readSource(args);
  await writeDestination(args, sourceConfigs);
  process.stdout.write(
    `Migrated ${sourceConfigs.length} configs for tenant=${args.tenantId} from ${args.from} to ${args.to}\n`,
  );
}

async function readSource(args: Args): Promise<DalConfigRecord[]> {
  if (args.from === 'json') {
    if (!args.file) throw new Error('--file is required for json source');
    const raw = await fs.readFile(args.file, 'utf8');
    const parsed = JSON.parse(raw) as { tenants?: Record<string, DalConfigRecord[]> };
    return parsed.tenants?.[args.tenantId] ?? [];
  }
  const sourceDal = await createPersistenceDal({
    provider: args.from === 'postgres' ? 'postgres' : 'mongodb',
    postgresConnectionString: args.from === 'postgres' ? args.fromUri : undefined,
    mongoUri: args.from === 'mongodb' ? args.fromUri : undefined,
    mongoDbName: args.mongoDbName,
  });
  const rows = await sourceDal.listConfigs({ tenantId: args.tenantId });
  await sourceDal.close?.();
  return rows;
}

async function writeDestination(args: Args, configs: DalConfigRecord[]): Promise<void> {
  if (args.to === 'json') {
    if (!args.file) throw new Error('--file is required for json destination');
    const payload = { tenants: { [args.tenantId]: configs } };
    await fs.writeFile(args.file, JSON.stringify(payload, null, 2), 'utf8');
    return;
  }
  const destinationDal = await createPersistenceDal({
    provider: args.to === 'postgres' ? 'postgres' : 'mongodb',
    postgresConnectionString: args.to === 'postgres' ? args.toUri : undefined,
    mongoUri: args.to === 'mongodb' ? args.toUri : undefined,
    mongoDbName: args.mongoDbName,
  });
  const context: TenantContext = { tenantId: args.tenantId, userId: 'migration', userName: 'migration' };
  for (const config of configs) {
    const orderedVersions = [...config.versions].reverse();
    for (const version of orderedVersions) {
      await destinationDal.saveConfig(context, {
        configId: config.configId,
        name: config.name,
        description: config.description,
        versionId: version.versionId,
        versionLabel: version.label,
        bundle: version.bundle,
      });
      await transitionTo(destinationDal, context, config.configId, version.versionId, version.status);
    }
  }
  await destinationDal.close?.();
}

async function transitionTo(
  dal: PersistenceDal,
  context: TenantContext,
  configId: string,
  versionId: string,
  status: ConfigLifecycleStatus,
): Promise<void> {
  if (status === 'Draft') return;
  const chain: ConfigLifecycleStatus[] = ['Submitted', 'Approved', 'Deprecated', 'Deleted'];
  for (const target of chain) {
    await dal.transitionVersion(context, { configId, versionId, toStatus: target });
    if (target === status) break;
  }
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key) continue;
    if (!key.startsWith('--')) continue;
    if (!value) break;
    const name = key.slice(2);
    if (name === 'from' || name === 'to' || name === 'tenantId' || name === 'file' || name === 'fromUri' || name === 'toUri' || name === 'mongoDbName') {
      (out as Record<string, unknown>)[name] = value;
      i += 1;
    }
  }

  if (!out.from || !out.to || !out.tenantId) {
    throw new Error('Usage: --from json|postgres|mongodb --to json|postgres|mongodb --tenantId <id> [--file <path>] [--fromUri <uri>] [--toUri <uri>] [--mongoDbName <db>]');
  }
  return out as Args;
}

void main();
