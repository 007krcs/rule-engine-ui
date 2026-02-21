import { describe, expect, it } from 'vitest';
import { ECRProvider, useECR } from '../src/index';

describe('@ecr-platform/core public api', () => {
  it('exports ECRProvider and useECR', () => {
    expect(typeof ECRProvider).toBe('function');
    expect(typeof useECR).toBe('function');
  });
});
