export type PaletteStep = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type ColorScale = Record<PaletteStep, string>;
export type DensityMode = 'comfortable' | 'compact';

export interface PlatformDesignTokens {
  colors: {
    primary: ColorScale;
    secondary: ColorScale;
    neutral: ColorScale;
    success: ColorScale;
    warning: ColorScale;
    error: ColorScale;
    surface: {
      canvas: string;
      layer: string;
      layerAlt: string;
      border: string;
      text: string;
      textMuted: string;
      focus: string;
      overlay: string;
      inverseText: string;
    };
  };
  typography: {
    fontFamilySans: string;
    fontFamilyMono: string;
    sizes: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
    };
    weights: {
      regular: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeights: {
      tight: string;
      normal: string;
      relaxed: string;
    };
  };
  spacing: Record<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12, string>;
  radii: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  zIndex: {
    dropdown: number;
    modal: number;
    toast: number;
    tooltip: number;
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
    easingStandard: string;
  };
  density: {
    controlHeights: {
      comfortable: {
        sm: string;
        md: string;
        lg: string;
      };
      compact: {
        sm: string;
        md: string;
        lg: string;
      };
    };
    controlPaddingX: {
      comfortable: {
        sm: string;
        md: string;
        lg: string;
      };
      compact: {
        sm: string;
        md: string;
        lg: string;
      };
    };
  };
}

const paletteSteps: PaletteStep[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export const lightDesignTokens: PlatformDesignTokens = {
  colors: {
    primary: {
      50: '#ebf3ff',
      100: '#dce9ff',
      200: '#b8d2ff',
      300: '#84afff',
      400: '#4f8cff',
      500: '#2f6af5',
      600: '#1e53d1',
      700: '#183fa0',
      800: '#163682',
      900: '#152e69',
    },
    secondary: {
      50: '#f6f1ff',
      100: '#ece3ff',
      200: '#dac7ff',
      300: '#c0a0ff',
      400: '#a377ff',
      500: '#8b52f3',
      600: '#7337ce',
      700: '#5a2ba1',
      800: '#4b2682',
      900: '#3d2069',
    },
    neutral: {
      50: '#f6f8fb',
      100: '#eef2f7',
      200: '#d9e1eb',
      300: '#b5c1cf',
      400: '#8898ac',
      500: '#66768e',
      600: '#4d5d73',
      700: '#3b4658',
      800: '#2b3442',
      900: '#1b2230',
    },
    success: {
      50: '#edfbf5',
      100: '#d5f5e7',
      200: '#afebd1',
      300: '#76dcb2',
      400: '#3fc18e',
      500: '#26a774',
      600: '#1a865d',
      700: '#166b4b',
      800: '#14563e',
      900: '#104634',
    },
    warning: {
      50: '#fff8eb',
      100: '#feefcc',
      200: '#fddf97',
      300: '#fbc45e',
      400: '#f7a934',
      500: '#eb8b17',
      600: '#ca6e0f',
      700: '#a6550f',
      800: '#874514',
      900: '#703b14',
    },
    error: {
      50: '#fff1f2',
      100: '#ffe2e6',
      200: '#ffc9d2',
      300: '#ff9bac',
      400: '#fe6985',
      500: '#f24062',
      600: '#d3264d',
      700: '#b11f43',
      800: '#951f3f',
      900: '#7f1f3b',
    },
    surface: {
      canvas: '#f5f7fb',
      layer: '#ffffff',
      layerAlt: '#eef2f7',
      border: '#d9e1eb',
      text: '#152033',
      textMuted: '#4d5d73',
      focus: 'rgba(47, 106, 245, 0.34)',
      overlay: 'rgba(13, 22, 39, 0.56)',
      inverseText: '#f8fbff',
    },
  },
  typography: {
    fontFamilySans: '"Plus Jakarta Sans", "Avenir Next", "Segoe UI", Arial, sans-serif',
    fontFamilyMono: '"IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace',
    sizes: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeights: {
      tight: '1.2',
      normal: '1.45',
      relaxed: '1.65',
    },
  },
  spacing: {
    0: '0px',
    1: '2px',
    2: '4px',
    3: '6px',
    4: '8px',
    5: '12px',
    6: '16px',
    7: '20px',
    8: '24px',
    9: '32px',
    10: '40px',
    11: '48px',
    12: '64px',
  },
  radii: {
    xs: '4px',
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '18px',
    '2xl': '24px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px rgba(15, 25, 38, 0.08)',
    md: '0 10px 30px rgba(18, 29, 49, 0.12)',
    lg: '0 14px 42px rgba(18, 29, 49, 0.18)',
    xl: '0 24px 70px rgba(18, 29, 49, 0.22)',
  },
  zIndex: {
    dropdown: 1000,
    modal: 1140,
    toast: 1210,
    tooltip: 1260,
  },
  transitions: {
    fast: '120ms',
    normal: '200ms',
    slow: '320ms',
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  density: {
    controlHeights: {
      comfortable: {
        sm: '32px',
        md: '40px',
        lg: '48px',
      },
      compact: {
        sm: '28px',
        md: '34px',
        lg: '40px',
      },
    },
    controlPaddingX: {
      comfortable: {
        sm: '8px',
        md: '12px',
        lg: '16px',
      },
      compact: {
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
    },
  },
};

export const darkDesignTokens: PlatformDesignTokens = {
  ...lightDesignTokens,
  colors: {
    ...lightDesignTokens.colors,
    primary: {
      50: '#dbe8ff',
      100: '#bfd4ff',
      200: '#95b6ff',
      300: '#6d98ff',
      400: '#4f8cff',
      500: '#3d7aff',
      600: '#2c65ed',
      700: '#2653c1',
      800: '#22489d',
      900: '#1f3f84',
    },
    secondary: {
      50: '#efe8ff',
      100: '#dfd0ff',
      200: '#c7adff',
      300: '#ad86ff',
      400: '#9668ff',
      500: '#8759fb',
      600: '#7343dd',
      700: '#5f35b8',
      800: '#4e2d95',
      900: '#412677',
    },
    neutral: {
      50: '#f2f4f7',
      100: '#e0e5ec',
      200: '#c1cad7',
      300: '#9caac0',
      400: '#7b8ba6',
      500: '#62728e',
      600: '#4e5c73',
      700: '#3c475a',
      800: '#293242',
      900: '#161c28',
    },
    success: {
      50: '#e9fbf3',
      100: '#c5f3df',
      200: '#9ae8c7',
      300: '#68d8aa',
      400: '#3ac38c',
      500: '#23ad77',
      600: '#1b8e61',
      700: '#176f4d',
      800: '#145a3f',
      900: '#114c36',
    },
    warning: {
      50: '#fff7e8',
      100: '#feebc5',
      200: '#fddb91',
      300: '#fbc35c',
      400: '#f5a734',
      500: '#e88c19',
      600: '#c86f11',
      700: '#a45810',
      800: '#854614',
      900: '#6f3a14',
    },
    error: {
      50: '#ffeff2',
      100: '#ffdde3',
      200: '#ffc1cd',
      300: '#ff91a7',
      400: '#ff647f',
      500: '#fa3d60',
      600: '#dc254c',
      700: '#b82042',
      800: '#9a203d',
      900: '#841f3a',
    },
    surface: {
      canvas: '#0e1521',
      layer: '#172131',
      layerAlt: '#1f2c41',
      border: '#2d3a4f',
      text: '#e7eef9',
      textMuted: '#a6b4cb',
      focus: 'rgba(79, 140, 255, 0.4)',
      overlay: 'rgba(7, 11, 18, 0.72)',
      inverseText: '#0f1728',
    },
  },
};

export function getDesignTokensForMode(mode: 'light' | 'dark'): PlatformDesignTokens {
  return mode === 'dark' ? darkDesignTokens : lightDesignTokens;
}

export function tokensToCssVars(
  tokens: PlatformDesignTokens,
  density: DensityMode,
): Record<string, string> {
  const vars: Record<string, string> = {
    '--pf-font-sans': tokens.typography.fontFamilySans,
    '--pf-font-mono': tokens.typography.fontFamilyMono,
    '--pf-font-size-xs': tokens.typography.sizes.xs,
    '--pf-font-size-sm': tokens.typography.sizes.sm,
    '--pf-font-size-md': tokens.typography.sizes.md,
    '--pf-font-size-lg': tokens.typography.sizes.lg,
    '--pf-font-size-xl': tokens.typography.sizes.xl,
    '--pf-font-size-2xl': tokens.typography.sizes['2xl'],
    '--pf-font-weight-regular': String(tokens.typography.weights.regular),
    '--pf-font-weight-medium': String(tokens.typography.weights.medium),
    '--pf-font-weight-semibold': String(tokens.typography.weights.semibold),
    '--pf-font-weight-bold': String(tokens.typography.weights.bold),
    '--pf-line-height-tight': tokens.typography.lineHeights.tight,
    '--pf-line-height-normal': tokens.typography.lineHeights.normal,
    '--pf-line-height-relaxed': tokens.typography.lineHeights.relaxed,
    '--pf-surface-canvas': tokens.colors.surface.canvas,
    '--pf-surface-layer': tokens.colors.surface.layer,
    '--pf-surface-layer-alt': tokens.colors.surface.layerAlt,
    '--pf-surface-border': tokens.colors.surface.border,
    '--pf-surface-text': tokens.colors.surface.text,
    '--pf-surface-text-muted': tokens.colors.surface.textMuted,
    '--pf-surface-focus': tokens.colors.surface.focus,
    '--pf-surface-overlay': tokens.colors.surface.overlay,
    '--pf-surface-inverse-text': tokens.colors.surface.inverseText,
    '--pf-radius-xs': tokens.radii.xs,
    '--pf-radius-sm': tokens.radii.sm,
    '--pf-radius-md': tokens.radii.md,
    '--pf-radius-lg': tokens.radii.lg,
    '--pf-radius-xl': tokens.radii.xl,
    '--pf-radius-2xl': tokens.radii['2xl'],
    '--pf-radius-full': tokens.radii.full,
    '--pf-shadow-sm': tokens.shadows.sm,
    '--pf-shadow-md': tokens.shadows.md,
    '--pf-shadow-lg': tokens.shadows.lg,
    '--pf-shadow-xl': tokens.shadows.xl,
    '--pf-z-dropdown': String(tokens.zIndex.dropdown),
    '--pf-z-modal': String(tokens.zIndex.modal),
    '--pf-z-toast': String(tokens.zIndex.toast),
    '--pf-z-tooltip': String(tokens.zIndex.tooltip),
    '--pf-motion-fast': tokens.transitions.fast,
    '--pf-motion-normal': tokens.transitions.normal,
    '--pf-motion-slow': tokens.transitions.slow,
    '--pf-motion-easing-standard': tokens.transitions.easingStandard,
    '--pf-transition-standard': `all ${tokens.transitions.normal} ${tokens.transitions.easingStandard}`,
    '--pf-density': density,
    '--pf-control-height-sm': tokens.density.controlHeights[density].sm,
    '--pf-control-height-md': tokens.density.controlHeights[density].md,
    '--pf-control-height-lg': tokens.density.controlHeights[density].lg,
    '--pf-control-padding-x-sm': tokens.density.controlPaddingX[density].sm,
    '--pf-control-padding-x-md': tokens.density.controlPaddingX[density].md,
    '--pf-control-padding-x-lg': tokens.density.controlPaddingX[density].lg,
  };

  appendColorScale(vars, 'primary', tokens.colors.primary);
  appendColorScale(vars, 'secondary', tokens.colors.secondary);
  appendColorScale(vars, 'neutral', tokens.colors.neutral);
  appendColorScale(vars, 'success', tokens.colors.success);
  appendColorScale(vars, 'warning', tokens.colors.warning);
  appendColorScale(vars, 'warn', tokens.colors.warning);
  appendColorScale(vars, 'error', tokens.colors.error);

  for (const [key, value] of Object.entries(tokens.spacing)) {
    vars[`--pf-space-${key}`] = value;
  }

  return vars;
}

function appendColorScale(
  target: Record<string, string>,
  colorName: string,
  scale: ColorScale,
): void {
  for (const step of paletteSteps) {
    target[`--pf-color-${colorName}-${step}`] = scale[step];
  }
}
