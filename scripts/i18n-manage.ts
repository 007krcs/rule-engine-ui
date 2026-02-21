import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PLATFORM_BUNDLES, createDevelopmentMachineTranslator, type TranslationBundle } from '@platform/i18n';

type ExtractedKey = {
  namespace: string;
  key: string;
  source: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args.command ?? 'coverage';
  const rootDir = process.cwd();
  const files = await collectFiles(rootDir, args.paths ?? ['apps', 'packages']);
  const extracted = await extractKeysFromFiles(rootDir, files);

  if (command === 'extract') {
    printExtracted(extracted);
    return;
  }

  const locales = (args.locales ?? 'en,de,fr,ar').split(',').map((entry) => entry.trim()).filter(Boolean);
  const bundleByLocaleAndNamespace = indexBundles(PLATFORM_BUNDLES);
  const coverage = checkCoverage(extracted, locales, bundleByLocaleAndNamespace);
  printCoverage(coverage);

  const shouldPrefill = Boolean(args.prefill);
  if (!shouldPrefill) return;

  const env = (process.env.RULEFLOW_ENV ?? process.env.NODE_ENV ?? 'development').toLowerCase();
  if (env !== 'development' && env !== 'staging') {
    console.warn(`[i18n-manage] Prefill skipped: env "${env}" is not development/staging.`);
    return;
  }

  const translator = createDevelopmentMachineTranslator();
  const prefilled = await prefillMissing(coverage, translator);
  printPrefill(prefilled);
}

function parseArgs(args: string[]): {
  command?: 'extract' | 'coverage';
  locales?: string;
  paths?: string[];
  prefill?: boolean;
} {
  const out: {
    command?: 'extract' | 'coverage';
    locales?: string;
    paths?: string[];
    prefill?: boolean;
  } = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === 'extract' || arg === 'coverage') {
      out.command = arg;
      continue;
    }
    if (arg === '--locales') {
      out.locales = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--paths') {
      out.paths = (args[i + 1] ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === '--prefill') {
      out.prefill = true;
      continue;
    }
  }

  return out;
}

async function collectFiles(rootDir: string, roots: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const root of roots) {
    const full = path.resolve(rootDir, root);
    const exists = await fileExists(full);
    if (!exists) continue;
    await walk(full, out);
  }
  return out.filter((file) => /\.(ts|tsx|js|jsx|json)$/.test(file));
}

async function walk(current: string, out: string[]): Promise<void> {
  const stat = await fs.stat(current);
  if (stat.isFile()) {
    out.push(current);
    return;
  }
  const base = path.basename(current);
  if (base === 'node_modules' || base === 'dist' || base === '.next' || base === '.turbo') return;
  const entries = await fs.readdir(current);
  for (const entry of entries) {
    await walk(path.join(current, entry), out);
  }
}

async function extractKeysFromFiles(rootDir: string, files: string[]): Promise<ExtractedKey[]> {
  const extracted: ExtractedKey[] = [];
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const source = path.relative(rootDir, file);
    extractFromContent(content, source, extracted);
  }
  return dedupeExtracted(extracted);
}

function extractFromContent(content: string, source: string, out: ExtractedKey[]): void {
  const patterns = [
    /ariaLabelKey["']?\s*[:=]\s*["'`]([^"'`]+)["'`]/g,
    /(?:labelKey|helperTextKey|placeholderKey)["']?\s*[:=]\s*["'`]([^"'`]+)["'`]/g,
    /\bt\(\s*["'`]([^"'`]+)["'`]/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const value = match[1]?.trim();
      if (!value) continue;
      const split = splitI18nKey(value);
      out.push({ namespace: split.namespace, key: split.key, source });
    }
  }
}

function splitI18nKey(value: string): { namespace: string; key: string } {
  if (value.includes(':')) {
    const [namespace, key] = value.split(':', 2);
    return { namespace: namespace || 'runtime', key: key || value };
  }
  if (value.includes('.')) {
    const [namespace, ...rest] = value.split('.');
    return { namespace: namespace || 'runtime', key: rest.join('.') || value };
  }
  return { namespace: 'runtime', key: value };
}

function dedupeExtracted(values: ExtractedKey[]): ExtractedKey[] {
  const map = new Map<string, ExtractedKey>();
  for (const value of values) {
    map.set(`${value.namespace}:${value.key}:${value.source}`, value);
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key) || a.source.localeCompare(b.source));
}

function indexBundles(bundles: TranslationBundle[]): Map<string, Map<string, Record<string, string>>> {
  const index = new Map<string, Map<string, Record<string, string>>>();
  for (const bundle of bundles) {
    const byLocale = index.get(bundle.locale) ?? new Map<string, Record<string, string>>();
    byLocale.set(bundle.namespace, bundle.messages);
    index.set(bundle.locale, byLocale);
  }
  return index;
}

function checkCoverage(
  keys: ExtractedKey[],
  locales: string[],
  index: Map<string, Map<string, Record<string, string>>>,
): Array<{ locale: string; missing: ExtractedKey[] }> {
  return locales.map((locale) => {
    const byLocale = index.get(locale) ?? new Map<string, Record<string, string>>();
    const missing = keys.filter((keyRef) => {
      const messages = byLocale.get(keyRef.namespace);
      return !messages || messages[keyRef.key] === undefined;
    });
    return { locale, missing };
  });
}

async function prefillMissing(
  coverage: Array<{ locale: string; missing: ExtractedKey[] }>,
  translator: { translate: (params: { text: string; fromLocale: string; toLocale: string; namespace: string; key: string }) => Promise<string> },
): Promise<Array<{ locale: string; key: string; value: string }>> {
  const out: Array<{ locale: string; key: string; value: string }> = [];
  for (const entry of coverage) {
    for (const missing of entry.missing.slice(0, 25)) {
      const translated = await translator.translate({
        text: missing.key,
        fromLocale: 'en',
        toLocale: entry.locale,
        namespace: missing.namespace,
        key: missing.key,
      });
      out.push({
        locale: entry.locale,
        key: `${missing.namespace}.${missing.key}`,
        value: translated,
      });
    }
  }
  return out;
}

function printExtracted(extracted: ExtractedKey[]): void {
  console.log(`Extracted ${extracted.length} keys`);
  for (const key of extracted) {
    console.log(`${key.namespace}.${key.key} (${key.source})`);
  }
}

function printCoverage(coverage: Array<{ locale: string; missing: ExtractedKey[] }>): void {
  for (const entry of coverage) {
    if (entry.missing.length === 0) {
      console.log(`[coverage] ${entry.locale}: complete`);
      continue;
    }
    console.warn(`[coverage] ${entry.locale}: missing ${entry.missing.length} keys`);
    for (const missing of entry.missing.slice(0, 20)) {
      console.warn(`  - ${missing.namespace}.${missing.key} (${missing.source})`);
    }
  }
}

function printPrefill(prefilled: Array<{ locale: string; key: string; value: string }>): void {
  if (prefilled.length === 0) {
    console.log('[prefill] nothing to prefill');
    return;
  }
  console.log(`[prefill] generated ${prefilled.length} machine-translated entries`);
  for (const item of prefilled.slice(0, 40)) {
    console.log(`  ${item.locale} ${item.key} => ${item.value}`);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

void main();
