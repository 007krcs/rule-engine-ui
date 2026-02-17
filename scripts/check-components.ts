import { builtinComponentDefinitions } from '../packages/component-registry/src/index.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function sortStrings(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

const registryImplemented = sortStrings(
  builtinComponentDefinitions()
    .filter((definition) => definition.adapterHint.startsWith('platform.'))
    .filter((definition) => definition.availability === 'implemented' && definition.supportsDrag)
    .map((definition) => definition.adapterHint),
);

const adapterMapSource = readFileSync(
  resolve(process.cwd(), 'packages/adapters/react-platform-adapter/src/component-map.tsx'),
  'utf8',
);
const adapterImplemented = sortStrings(
  Array.from(
    new Set(
      [...adapterMapSource.matchAll(/'((platform\.[^']+))'\s*:/g)].map((match) => match[1]),
    ),
  ),
);

const registrySet = new Set(registryImplemented);
const adapterSet = new Set(adapterImplemented);

const missingInAdapter = registryImplemented.filter((id) => !adapterSet.has(id));
const missingInRegistry = adapterImplemented.filter((id) => !registrySet.has(id));

if (missingInAdapter.length > 0 || missingInRegistry.length > 0) {
  const lines = [
    'Component contract mismatch detected.',
    missingInAdapter.length > 0
      ? `- Implemented in registry but missing in adapter: ${missingInAdapter.join(', ')}`
      : null,
    missingInRegistry.length > 0
      ? `- Implemented in adapter map but missing/disabled in registry: ${missingInRegistry.join(', ')}`
      : null,
  ].filter((line): line is string => Boolean(line));

  console.error(lines.join('\n'));
  process.exit(1);
}

console.log(
  `Component contract check passed (${registryImplemented.length} implemented platform components).`,
);
