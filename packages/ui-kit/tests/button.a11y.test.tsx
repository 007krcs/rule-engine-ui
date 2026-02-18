import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PFButton } from '../src';

describe('PFButton accessibility states', () => {
  it('is disabled and busy when loading', () => {
    render(
      <PFButton loading>
        Save changes
      </PFButton>,
    );

    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('is enabled and has accessible name when active', () => {
    render(
      <PFButton>
        Publish
      </PFButton>,
    );

    const button = screen.getByRole('button', { name: 'Publish' });
    expect(button).toBeEnabled();
    expect(button).toHaveAccessibleName('Publish');
  });
});

