import { describe, expect, it } from 'vitest';
import { getRendererAdapter, listRendererAdapters } from '../src/index';

describe('adapters package', () => {
  it('lists default renderer adapters', () => {
    expect(listRendererAdapters()).toHaveLength(3);
  });

  it('returns adapter by framework', () => {
    expect(getRendererAdapter('react')?.packageName).toBe('@platform/react-renderer');
  });
});
