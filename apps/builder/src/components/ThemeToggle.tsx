'use client';

import { Button } from '@platform/component-system';
import { useBuilderTheme } from './BuilderThemeProvider';

export function ThemeToggle() {
  const { mode, toggleMode } = useBuilderTheme();
  return (
    <Button variant="ghost" size="sm" onClick={toggleMode}>
      Theme: {mode === 'dark' ? 'Dark' : 'Light'}
    </Button>
  );
}
