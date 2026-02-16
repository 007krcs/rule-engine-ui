import { describe, expect, it } from 'vitest';
import {
  compileThemeToCssVariables,
  createPlatformTheme,
  defaultTheme,
  toCssDeclarationBlock,
} from '../src/tokens';
import { loadTenantTheme } from '../src/theme';

describe('@platform/ui-kit tokens', () => {
  it('compiles default theme into CSS variables', () => {
    const vars = compileThemeToCssVariables(defaultTheme);
    expect(vars['--pf-color-primary-500']).toBe('#2f6af5');
    expect(vars['--pf-radius-md']).toBe('0.625rem');
    expect(vars['--pf-space-2']).toBe('0.5rem');
    expect(vars['--pf-density']).toBe('comfortable');
  });

  it('merges tenant theme overrides', async () => {
    const theme = await loadTenantTheme(() => ({
      density: 'compact',
      palette: {
        primary: {
          500: '#0052cc',
        },
      },
      brand: {
        name: 'Tenant X',
      },
    }));

    expect(theme.brand.name).toBe('Tenant X');
    expect(theme.palette.primary[500]).toBe('#0052cc');
    expect(theme.density).toBe('compact');
    expect(theme.palette.neutral[100]).toBe(defaultTheme.palette.neutral[100]);
  });

  it('creates a CSS declaration block', () => {
    const theme = createPlatformTheme({
      spacing: {
        4: '2rem',
      },
    });
    const vars = compileThemeToCssVariables(theme);
    const cssBlock = toCssDeclarationBlock({
      '--pf-space-4': vars['--pf-space-4'],
      '--pf-color-primary-500': vars['--pf-color-primary-500'],
    });

    expect(cssBlock).toContain('--pf-space-4: 2rem;');
    expect(cssBlock).toContain('--pf-color-primary-500: #2f6af5;');
  });
});
