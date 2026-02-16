'use client';

import { PFButton, PFButtonGroup } from '@platform/ui-kit';
import { useTheme } from '@/components/layout/theme-provider';

export function DensityToggle() {
  const { density, setDensity } = useTheme();

  return (
    <PFButtonGroup ariaLabel="Density mode">
      <PFButton
        size="sm"
        variant={density === 'comfortable' ? 'solid' : 'ghost'}
        intent={density === 'comfortable' ? 'primary' : 'neutral'}
        onClick={() => setDensity('comfortable')}
      >
        Cozy
      </PFButton>
      <PFButton
        size="sm"
        variant={density === 'compact' ? 'solid' : 'ghost'}
        intent={density === 'compact' ? 'primary' : 'neutral'}
        onClick={() => setDensity('compact')}
      >
        Compact
      </PFButton>
    </PFButtonGroup>
  );
}
