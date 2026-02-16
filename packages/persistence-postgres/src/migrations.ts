import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SqlPool } from './sql-client';
import { createSqlPoolFromPg } from './sql-client';

export interface RunMigrationsInput {
  connectionString?: string;
  pool?: SqlPool;
  migrationsDir?: string;
}

export interface AppliedMigration {
  id: string;
  checksum: string;
  applied: boolean;
}

type AppliedMigrationRow = {
  id: string;
  checksum: string;
};

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function defaultMigrationsDir(): string {
  const filePath = fileURLToPath(import.meta.url);
  const packageRoot = path.resolve(path.dirname(filePath), '..');
  return path.join(packageRoot, 'migrations');
}

async function listMigrationFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(pool: SqlPool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function runPostgresMigrations(input: RunMigrationsInput): Promise<AppliedMigration[]> {
  const migrationsDir = input.migrationsDir ?? defaultMigrationsDir();
  const ownPool = input.pool ? null : await createSqlPoolFromPg({ connectionString: requiredConnectionString(input) });
  const pool = input.pool ?? ownPool!;

  try {
    await ensureMigrationsTable(pool);
    const existingRows = await pool.query<AppliedMigrationRow>('SELECT id, checksum FROM schema_migrations');
    const existing = new Map(existingRows.rows.map((row) => [row.id, row.checksum]));

    const files = await listMigrationFiles(migrationsDir);
    const applied: AppliedMigration[] = [];

    for (const file of files) {
      const migrationId = file;
      const fullPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(fullPath, 'utf8');
      const checksum = sha256(sql);
      const alreadyChecksum = existing.get(migrationId);
      if (alreadyChecksum) {
        if (alreadyChecksum !== checksum) {
          throw new Error(`Migration checksum mismatch for ${migrationId}`);
        }
        applied.push({ id: migrationId, checksum, applied: false });
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)', [migrationId, checksum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      applied.push({ id: migrationId, checksum, applied: true });
    }

    return applied;
  } finally {
    if (ownPool) {
      await ownPool.end();
    }
  }
}

function requiredConnectionString(input: RunMigrationsInput): string {
  const value = input.connectionString ?? process.env.DATABASE_URL;
  if (!value) {
    throw new Error('DATABASE_URL is required to run Postgres migrations');
  }
  return value;
}
