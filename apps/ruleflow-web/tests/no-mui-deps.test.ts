import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('core app dependency guardrails', () => {
  it('does not depend on MUI, Emotion, or the material adapter directly', () => {
    const packageJsonPath = new URL('../package.json', import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    const allDeps = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
      ...(packageJson.peerDependencies ?? {}),
    };

    const disallowed = Object.keys(allDeps).filter((name) =>
      name.startsWith('@mui/') || name.startsWith('@emotion/'),
    );

    expect(disallowed).toEqual([]);
    expect(allDeps['@platform/react-material-adapter']).toBeUndefined();
    expect(allDeps['@platform/theme-bridge']).toBeUndefined();
  });
});
