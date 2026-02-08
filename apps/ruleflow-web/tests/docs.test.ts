import { describe, expect, it } from 'vitest';
import { docs } from '../src/lib/docs';

describe('ruleflow-web docs', () => {
  it('uses unique slugs', () => {
    const slugs = docs.map((doc) => doc.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });
});
