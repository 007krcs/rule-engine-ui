import { describe, expect, it } from 'vitest';
import { buildPlaygroundSnapshot } from '../src/lib/playground-runtime';

describe('buildPlaygroundSnapshot', () => {
  it('creates a readable runtime snapshot', () => {
    const snapshot = buildPlaygroundSnapshot(['validate', 'runRules'], 4);

    expect(snapshot.stepCount).toBe(2);
    expect(snapshot.firstStep).toBe('validate');
    expect(snapshot.componentCount).toBe(4);
  });
});
