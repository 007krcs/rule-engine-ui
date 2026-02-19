import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(rootDir, 'src');
const distDir = join(rootDir, 'dist');

function copyCssModules(currentDir) {
  for (const entry of readdirSync(currentDir)) {
    const fullPath = join(currentDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      copyCssModules(fullPath);
      continue;
    }
    if (!entry.endsWith('.module.css')) continue;
    const relativePath = relative(srcDir, fullPath);
    const targetPath = join(distDir, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(fullPath, targetPath);
  }
}

copyCssModules(srcDir);
