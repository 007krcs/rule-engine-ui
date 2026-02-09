'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/layout/theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Toggle theme"
      onClick={() => setTheme(nextTheme)}
    >
      {theme === 'dark' ? (
        <Sun width={16} height={16} aria-hidden="true" focusable="false" />
      ) : (
        <Moon width={16} height={16} aria-hidden="true" focusable="false" />
      )}
    </Button>
  );
}
