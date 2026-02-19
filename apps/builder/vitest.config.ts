import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'builder',
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      environment: 'jsdom',
      setupFiles: ['tests/setup.ts'],
    },
  }),
);
