import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testFileDir, '..', '..', '..');

const SOURCE_ROOTS = ['apps', 'packages', 'scripts', '.github'];
const SKIP_SEGMENTS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  'test-results',
  '.git',
]);

function listTrackedFiles(): string[] {
  const raw = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' });
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function shouldSkipDirectory(dirPath: string): boolean {
  const relative = path.relative(repoRoot, dirPath);
  if (!relative || relative === '.') {
    return false;
  }
  const segments = relative.split(path.sep);
  return segments.some(
    (segment) =>
      SKIP_SEGMENTS.has(segment) ||
      segment.startsWith('.next_backup_') ||
      segment.startsWith('.next_stale_'),
  );
}

function collectEmptyDirectories(rootPath: string): string[] {
  const empty: string[] = [];

  const walk = (currentPath: string) => {
    if (shouldSkipDirectory(currentPath)) {
      return;
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    const fileEntries = entries.filter((entry) => entry.isFile());
    const dirEntries = entries.filter((entry) => entry.isDirectory());

    for (const child of dirEntries) {
      walk(path.join(currentPath, child.name));
    }

    if (fileEntries.length === 0 && dirEntries.length === 0) {
      empty.push(path.relative(repoRoot, currentPath).replace(/\\/g, '/'));
    }
  };

  walk(rootPath);
  return empty;
}

describe('repo health', () => {
  it('has no zero-byte tracked files', () => {
    const zeroByte = listTrackedFiles().filter((relativePath) => {
      const fullPath = path.join(repoRoot, relativePath);
      if (!fs.existsSync(fullPath)) {
        return false;
      }
      const stat = fs.statSync(fullPath);
      return stat.isFile() && stat.size === 0;
    });

    expect(zeroByte).toEqual([]);
  });

  it('has no empty directories inside source roots', () => {
    const emptyDirectories: string[] = [];

    for (const root of SOURCE_ROOTS) {
      const fullPath = path.join(repoRoot, root);
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
        continue;
      }
      emptyDirectories.push(...collectEmptyDirectories(fullPath));
    }

    expect(emptyDirectories).toEqual([]);
  });
});
