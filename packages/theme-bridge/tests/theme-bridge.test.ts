import { describe, expect, it } from 'vitest';
import { createMuiThemeFromPlatformTheme, platformThemeToMuiThemeOptions } from '../src/index';

describe('theme-bridge', () => {
  it('maps platform theme to mui theme options', () => {
    const options = platformThemeToMuiThemeOptions({
      mode: 'light',
      density: 'comfortable',
      visual: 'layered',
      brand: {
        primary: '#1f6feb',
      },
    });

    expect(options.palette?.mode).toBe('light');
    expect(options.palette?.primary).toBeDefined();
  });

  it('creates a mui theme object', () => {
    const theme = createMuiThemeFromPlatformTheme({
      mode: 'dark',
      density: 'compact',
      visual: 'flat',
      brand: {},
    });

    expect(theme.palette.mode).toBe('dark');
    expect(theme.spacing(1)).toBe('8px');
  });
});
