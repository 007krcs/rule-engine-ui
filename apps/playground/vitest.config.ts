import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'playground',
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  }),
);
