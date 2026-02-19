import { describe, expect, it, vi } from 'vitest';
import BuilderIndexPage from '../src/app/builder/page';

const redirectMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
  usePathname: () => '/builder/screens',
}));

describe('builder index redirect', () => {
  it('redirects /builder to /builder/screens', () => {
    BuilderIndexPage();
    expect(redirectMock).toHaveBeenCalledWith('/builder/screens');
  });
});
