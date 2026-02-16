import { describe, expect, it } from 'vitest';
import { createThemeVars, deriveColorScale, type PlatformTheme } from '../src/theme';
import { getDesignTokensForMode, tokensToCssVars } from '../src/tokens';

describe('@platform/ui-kit theme', () => {
  it('generates CSS vars from a theme contract', () => {
    const theme: PlatformTheme = {
      mode: 'light',
      density: 'comfortable',
    };
    const vars = createThemeVars(theme);

    expect(vars['--pf-color-primary-500']).toBe('#2f6af5');
    expect(vars['--pf-radius-md']).toBe('10px');
    expect(vars['--pf-space-2']).toBe('4px');
    expect(vars['--pf-density']).toBe('comfortable');
  });

  it('uses compact density control heights when requested', () => {
    const compact = tokensToCssVars(getDesignTokensForMode('light'), 'compact');
    const comfortable = tokensToCssVars(getDesignTokensForMode('light'), 'comfortable');

    expect(compact['--pf-control-height-md']).toBe('34px');
    expect(comfortable['--pf-control-height-md']).toBe('40px');
    expect(compact['--pf-control-padding-x-md']).toBe('8px');
  });

  it('applies brand overrides and derives color scale from base color', () => {
    const vars = createThemeVars({
      mode: 'dark',
      density: 'compact',
      brand: {
        primary: '#0055aa',
        secondary: '#5b2c90',
        fontFamily: '"IBM Plex Sans", sans-serif',
        radiusScale: 1.2,
      },
    });

    expect(vars['--pf-font-sans']).toContain('IBM Plex Sans');
    expect(vars['--pf-density']).toBe('compact');
    expect(vars['--pf-radius-md']).toBe('12px');
    expect(vars['--pf-color-primary-500']).toBe(deriveColorScale('#0055aa')[500]);
    expect(vars['--pf-color-secondary-500']).toBe(deriveColorScale('#5b2c90')[500]);
  });
});
