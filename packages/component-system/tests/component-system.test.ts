import { describe, expect, it } from 'vitest';
import { findComponentContract, getDefaultComponentCatalog } from '../src/index';

describe('component-system catalog', () => {
  it('returns a non-empty default catalog', () => {
    const catalog = getDefaultComponentCatalog();
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('can find a known component contract', () => {
    const contract = findComponentContract('input.text');
    expect(contract?.displayName).toBe('Text Input');
  });
});
