import { promises as fs } from 'node:fs';
import { migrateBundleToMultiPage } from '@platform/schema';

type Args = {
  input: string;
  output?: string;
  format: 'auto' | 'bundle' | 'gitops';
  dryRun: boolean;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(args.input, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const result = migrateDocument(parsed, args.format);
  const outPath = args.output ?? args.input;

  if (!args.dryRun) {
    await fs.writeFile(outPath, JSON.stringify(result.document, null, 2), 'utf8');
  }

  process.stdout.write(
    `Migrated ${result.migratedBundles} bundle(s), changed ${result.changedBundles}. dryRun=${args.dryRun}\n`,
  );
}

function migrateDocument(
  doc: unknown,
  format: Args['format'],
): { document: unknown; migratedBundles: number; changedBundles: number } {
  if (format === 'bundle') {
    const migrated = migrateBundleToMultiPage(doc as Record<string, unknown>);
    return { document: migrated.migrated, migratedBundles: 1, changedBundles: migrated.changed ? 1 : 0 };
  }
  if (format === 'gitops' || isGitOpsBundle(doc)) {
    return migrateGitOps(doc as Record<string, unknown>);
  }
  const migrated = migrateBundleToMultiPage(doc as Record<string, unknown>);
  return { document: migrated.migrated, migratedBundles: 1, changedBundles: migrated.changed ? 1 : 0 };
}

function migrateGitOps(bundle: Record<string, unknown>): {
  document: unknown;
  migratedBundles: number;
  changedBundles: number;
} {
  const next = JSON.parse(JSON.stringify(bundle)) as {
    payload?: {
      versions?: Array<{ bundle?: Record<string, unknown> }>;
      packages?: Array<{ versions?: Array<{ bundle?: Record<string, unknown> }> }>;
    };
  };
  const payload = next.payload ?? {};
  let migratedBundles = 0;
  let changedBundles = 0;

  for (const version of payload.versions ?? []) {
    if (!version.bundle) continue;
    migratedBundles += 1;
    const migrated = migrateBundleToMultiPage(version.bundle);
    version.bundle = migrated.migrated;
    if (migrated.changed) changedBundles += 1;
  }

  for (const pkg of payload.packages ?? []) {
    for (const version of pkg.versions ?? []) {
      if (!version.bundle) continue;
      migratedBundles += 1;
      const migrated = migrateBundleToMultiPage(version.bundle);
      version.bundle = migrated.migrated;
      if (migrated.changed) changedBundles += 1;
    }
  }

  next.payload = payload;
  return { document: next, migratedBundles, changedBundles };
}

function isGitOpsBundle(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  return Boolean(rec.payload && typeof rec.payload === 'object' && rec.schemaVersion === 1);
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    input: '',
    format: 'auto',
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    const next = argv[i + 1];
    if (!next) continue;
    if (arg === '--in') {
      out.input = next;
      i += 1;
      continue;
    }
    if (arg === '--out') {
      out.output = next;
      i += 1;
      continue;
    }
    if (arg === '--format' && (next === 'auto' || next === 'bundle' || next === 'gitops')) {
      out.format = next;
      i += 1;
    }
  }
  if (!out.input) {
    throw new Error('Usage: tsx scripts/migrate-ui-schema.ts --in <input.json> [--out <output.json>] [--format auto|bundle|gitops] [--dry-run]');
  }
  return out;
}

void main();
