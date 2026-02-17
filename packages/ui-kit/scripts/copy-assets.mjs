import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}
