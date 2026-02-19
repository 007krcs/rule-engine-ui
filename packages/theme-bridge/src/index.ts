import {
  deriveColorScale,
  getDesignTokensForMode,
  type PlatformTheme,
} from '@platform/ui-kit';

export type PaletteMode = 'light' | 'dark';

export interface ThemePaletteColor {
  main: string;
  light?: string;
  dark?: string;
  contrastText?: string;
}

export interface ThemePalette {
  mode: PaletteMode;
  primary: ThemePaletteColor;
  secondary: ThemePaletteColor;
  success: ThemePaletteColor;
  warning: ThemePaletteColor;
  error: ThemePaletteColor;
  background: {
    default: string;
    paper: string;
  };
  text: {
    primary: string;
    secondary: string;
  };
  divider: string;
}

export interface ThemeOptions {
  spacing: number;
  shape: {
    borderRadius: number;
  };
  palette: ThemePalette;
  typography: Record<string, unknown>;
  components: Record<string, unknown>;
}

export type Theme = Omit<ThemeOptions, 'spacing'> & {
  spacing: (factor: number) => string;
};

export function createMuiThemeFromPlatformTheme(
  platformTheme: PlatformTheme,
): Theme {
  const options = platformThemeToMuiThemeOptions(platformTheme);
  const spacingBase = options.spacing ?? 8;
  return {
    ...options,
    spacing: (factor: number) => `${Math.round(spacingBase * factor)}px`,
  };
}

export function platformThemeToMuiThemeOptions(
  platformTheme: PlatformTheme,
): ThemeOptions {
  const mode: PaletteMode = platformTheme.mode === 'dark' ? 'dark' : 'light';
  const tokens = getDesignTokensForMode(platformTheme.mode);
  const primaryScale = platformTheme.brand?.primary
    ? deriveColorScale(platformTheme.brand.primary)
    : tokens.colors.primary;
  const secondaryScale = platformTheme.brand?.secondary
    ? deriveColorScale(platformTheme.brand.secondary)
    : tokens.colors.secondary;
  const radiusScale = clamp(platformTheme.brand?.radiusScale ?? 1, 0.5, 2);
  const baseRadius = px(tokens.radii.md, 10);

  return {
    spacing: 8,
    shape: {
      borderRadius: Math.round(baseRadius * radiusScale),
    },
    palette: {
      mode,
      primary: {
        main: primaryScale[500],
        light: primaryScale[300],
        dark: primaryScale[700],
        contrastText: tokens.colors.surface.inverseText,
      },
      secondary: {
        main: secondaryScale[500],
        light: secondaryScale[300],
        dark: secondaryScale[700],
        contrastText: tokens.colors.surface.inverseText,
      },
      success: {
        main: tokens.colors.success[500],
      },
      warning: {
        main: tokens.colors.warning[500],
      },
      error: {
        main: tokens.colors.error[500],
      },
      background: {
        default: tokens.colors.surface.canvas,
        paper: tokens.colors.surface.layer,
      },
      text: {
        primary: tokens.colors.surface.text,
        secondary: tokens.colors.surface.textMuted,
      },
      divider: tokens.colors.surface.border,
    },
    typography: {
      fontFamily:
        platformTheme.brand?.fontFamily || tokens.typography.fontFamilySans,
      fontSize: px(tokens.typography.sizes.md, 16),
      h1: {
        fontSize: tokens.typography.sizes['2xl'],
        lineHeight: tokens.typography.lineHeights.tight,
        fontWeight: tokens.typography.weights.bold,
      },
      h2: {
        fontSize: tokens.typography.sizes.xl,
        lineHeight: tokens.typography.lineHeights.tight,
        fontWeight: tokens.typography.weights.semibold,
      },
      body1: {
        fontSize: tokens.typography.sizes.md,
        lineHeight: tokens.typography.lineHeights.normal,
      },
      body2: {
        fontSize: tokens.typography.sizes.sm,
        lineHeight: tokens.typography.lineHeights.normal,
      },
      button: {
        textTransform: 'none',
        fontWeight: tokens.typography.weights.semibold,
      },
    },
    components: {
      Paper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${tokens.colors.surface.border}`,
          },
        },
      },
      Button: {
        styleOverrides: {
          root: {
            borderRadius: Math.round(px(tokens.radii.sm, 6) * radiusScale),
            minHeight:
              platformTheme.density === 'compact'
                ? px(tokens.density.controlHeights.compact.md, 34)
                : px(tokens.density.controlHeights.comfortable.md, 40),
            boxShadow: tokens.shadows.sm,
          },
        },
      },
      TextField: {
        defaultProps: {
          variant: 'outlined',
        },
      },
      OutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: Math.round(px(tokens.radii.sm, 6) * radiusScale),
          },
          input: {
            paddingTop:
              platformTheme.density === 'compact'
                ? px(tokens.spacing[4], 8)
                : px(tokens.spacing[5], 12),
            paddingBottom:
              platformTheme.density === 'compact'
                ? px(tokens.spacing[4], 8)
                : px(tokens.spacing[5], 12),
          },
        },
      },
    },
  };
}

function px(raw: string, fallback: number): number {
  const parsed = Number.parseFloat(raw.replace('px', '').trim());
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
