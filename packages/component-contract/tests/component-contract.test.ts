import { describe, expect, it } from 'vitest';
import { isComponentContract } from '../src/index';

describe('isComponentContract', () => {
  it('returns true for valid contracts', () => {
    expect(
      isComponentContract({
        type: 'input.text',
        displayName: 'Text Input',
        category: 'input',
        bindings: [],
        events: [],
        propsSchema: {},
      }),
    ).toBe(true);
  });

  it('returns false for incomplete contracts', () => {
    expect(isComponentContract({ type: 'input.text' })).toBe(false);
  });
});
