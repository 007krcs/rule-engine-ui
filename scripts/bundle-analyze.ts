import fs from 'node:fs/promises';
import path from 'node:path';

type Entry = {
  file: string;
  bytes: number;
  imports: number;
};

const DEFAULT_SCAN_DIRS = [
  'packages/component-system/src',
  'packages/adapters',
  'apps/ruleflow-web/src',
];

const JS_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

async function main() {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const top = parsePositive(readArg(args, '--top')) ?? 20;
  const minKb = parsePositive(readArg(args, '--minKb')) ?? 12;
  const dirs = parseList(readArg(args, '--paths')) ?? DEFAULT_SCAN_DIRS;
  const minBytes = minKb * 1024;

  const files = await collectFiles(root, dirs);
  const entries: Entry[] = [];
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const imports = (content.match(/\b(import|require)\b/g) ?? []).length;
    entries.push({
      file: path.relative(root, file).replace(/\\/g, '/'),
      bytes: Buffer.byteLength(content, 'utf8'),
      imports,
    });
  }

  const heavy = entries
    .filter((entry) => entry.bytes >= minBytes)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, top);

  if (heavy.length === 0) {
    process.stdout.write(`No files >= ${minKb}KB found.\n`);
    return;
  }

  process.stdout.write(`Bundle audit report (threshold=${minKb}KB, top=${top})\n`);
  for (const item of heavy) {
    const kb = (item.bytes / 1024).toFixed(1);
    const suggestion = suggestOptimization(item);
    process.stdout.write(`- ${item.file} :: ${kb}KB :: imports=${item.imports} :: ${suggestion}\n`);
  }
}

function suggestOptimization(entry: Entry): string {
  if (entry.imports > 25) return 'Split module boundaries and lazy-load feature branches.';
  if (entry.file.includes('/components/')) return 'Consider code-splitting component variants and deferring mock data.';
  if (entry.file.includes('/adapters/')) return 'Move optional adapter dependencies behind dynamic import.';
  return 'Review dead code, tree-shaking, and payload duplication.';
}

async function collectFiles(root: string, dirs: string[]): Promise<string[]> {
  const all: string[] = [];
  for (const dir of dirs) {
    const abs = path.resolve(root, dir);
    await walk(abs, all);
  }
  return all;
}

async function walk(dir: string, out: string[]) {
  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
      await walk(abs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!JS_EXT.has(path.extname(entry.name))) continue;
    out.push(abs);
  }
}

function readArg(args: string[], key: string): string | undefined {
  const match = args.find((arg) => arg.startsWith(`${key}=`));
  return match ? match.slice(key.length + 1) : undefined;
}

function parseList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const out = value
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return out.length > 0 ? out : undefined;
}

function parsePositive(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

void main();
