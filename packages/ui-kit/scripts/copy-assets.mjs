import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'sass';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const srcStyles = resolve(root, 'src', 'styles', 'index.scss');
const outDir = resolve(root, 'dist');
const outStyles = resolve(outDir, 'styles.css');
const outScss = resolve(outDir, 'styles.scss');
const partialDirs = ['abstracts', 'foundations', 'visuals', 'components'];

mkdirSync(outDir, { recursive: true });
const compiled = compile(srcStyles, { style: 'expanded' });
writeFileSync(outStyles, compiled.css);
copyFileSync(srcStyles, outScss);

for (const dir of partialDirs) {
  const source = resolve(root, 'src', 'styles', dir);
  const target = resolve(outDir, dir);

  // Keep compiled TS output in dist/components intact.
  if (dir !== 'components') {
    rmSync(target, { recursive: true, force: true });
  }

  cpSync(source, target, { recursive: true, force: true });
}

rewriteRelativeJsSpecifiers(outDir);

function rewriteRelativeJsSpecifiers(directory) {
  const jsFiles = collectJsFiles(directory);
  for (const file of jsFiles) {
    const before = readFileSync(file, 'utf8');
    const after = before
      .replace(/(from\s*['"])(\.[^'"]+)(['"])/g, (full, prefix, specifier, suffix) => {
        return `${prefix}${resolveSpecifier(file, specifier)}${suffix}`;
      })
      .replace(/(import\s*\(\s*['"])(\.[^'"]+)(['"]\s*\))/g, (full, prefix, specifier, suffix) => {
        return `${prefix}${resolveSpecifier(file, specifier)}${suffix}`;
      });
    if (after !== before) {
      writeFileSync(file, after);
    }
  }
}

function collectJsFiles(directory) {
  const queue = [directory];
  const files = [];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    const entries = readdirSync(current);
    for (const entry of entries) {
      const full = resolve(current, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        queue.push(full);
        continue;
      }
      if (full.endsWith('.js')) {
        files.push(full);
      }
    }
  }
  return files;
}

function resolveSpecifier(file, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  if (/\.(?:[cm]?js|json)$/.test(specifier)) return specifier;

  const base = resolve(dirname(file), specifier);
  if (existsSync(`${base}.js`)) {
    return `${specifier}.js`;
  }
  if (existsSync(resolve(base, 'index.js'))) {
    return specifier.endsWith('/') ? `${specifier}index.js` : `${specifier}/index.js`;
  }
  return specifier;
}
