'use client';

import { Moon, Sun } from 'lucide-react';
import { PFIconButton } from '@platform/ui-kit';
import { useTheme } from '@/components/layout/theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';

  return (
    <PFIconButton
      variant="ghost"
      size="sm"
      label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(nextTheme)}
    >
      {isDark ? (
        <Sun width={16} height={16} aria-hidden="true" focusable="false" />
      ) : (
        <Moon width={16} height={16} aria-hidden="true" focusable="false" />
      )}
    </PFIconButton>
  );
}
