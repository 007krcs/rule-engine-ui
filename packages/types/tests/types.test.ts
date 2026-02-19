import { describe, expect, it } from 'vitest';
import type { PlatformComponentMeta } from '../src/index';

describe('types package', () => {
  it('supports strongly typed component metadata objects', () => {
    const component: PlatformComponentMeta = {
      id: 'input.text',
      category: 'input',
      availability: 'implemented',
      propsSchema: {
        type: 'object',
        properties: {
          placeholder: { type: 'string' },
        },
      },
      supportsDrag: true,
    };

    expect(component.id).toBe('input.text');
    expect(component.supportsDrag).toBe(true);
  });
});
