import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.shared';

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'component-system',
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  }),
);
