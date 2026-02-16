import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const srcStyles = resolve(root, 'src', 'styles', 'index.scss');
const outDir = resolve(root, 'dist');
const outStyles = resolve(outDir, 'styles.css');
const outScss = resolve(outDir, 'styles.scss');

mkdirSync(outDir, { recursive: true });
copyFileSync(srcStyles, outStyles);
copyFileSync(srcStyles, outScss);
