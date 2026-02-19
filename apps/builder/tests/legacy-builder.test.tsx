import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import LegacyBuilderPage from '../src/app/builder/legacy/page';
import ReactLib from 'react';

// Mock hooks used in legacy builder dependencies
vi.mock('next/navigation', () => ({
  usePathname: () => '/builder/legacy',
  useRouter: () => ({ push: vi.fn() }),
}));

// Ensure React is available for components that expect it in scope
vi.stubGlobal('React', ReactLib);

describe('legacy builder route', () => {
  it('renders the legacy canvas workspace', () => {
    render(<LegacyBuilderPage />);
    expect(screen.getByText(/Canvas Workspace \(Legacy\)/i)).toBeInTheDocument();
  });
});
