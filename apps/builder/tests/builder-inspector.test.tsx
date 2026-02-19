import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuilderWorkspaceLayout } from '../src/components/BuilderWorkspaceLayout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/builder/screens',
}));

function mockMatchMedia(matches = false) {
  const mediaQueryList: MediaQueryList = {
    matches,
    media: '',
    onchange: null,
    addListener: vi.fn() as unknown as MediaQueryList['addListener'],
    removeListener: vi.fn() as unknown as MediaQueryList['removeListener'],
    addEventListener: vi.fn() as unknown as MediaQueryList['addEventListener'],
    removeEventListener: vi.fn() as unknown as MediaQueryList['removeEventListener'],
    dispatchEvent: vi.fn() as unknown as MediaQueryList['dispatchEvent'],
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mediaQueryList));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('inspector toggle', () => {
  it('shows and hides inspector panel', () => {
    mockMatchMedia(false); // desktop view -> inspector open
    render(
      <BuilderWorkspaceLayout>
        <div>Workspace body</div>
      </BuilderWorkspaceLayout>,
    );

    const inspector = screen.getByLabelText('Inspector panel');
    expect(inspector).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Hide Inspector/i }));
    expect(screen.getByLabelText('Inspector panel').className).toMatch(/drawerHidden/i);

    fireEvent.click(screen.getByRole('button', { name: /Show Inspector/i }));
    expect(screen.getByLabelText('Inspector panel').className).not.toMatch(/drawerHidden/i);
  });
});
