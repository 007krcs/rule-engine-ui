export type ThemeMode = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

export type PaletteStep = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type ColorScale = Record<PaletteStep, string>;

export interface PlatformTheme {
  brand: {
    name: string;
    logoUrl?: string;
  };
  palette: {
    primary: ColorScale;
    secondary: ColorScale;
    neutral: ColorScale;
    success: ColorScale;
    warn: ColorScale;
    error: ColorScale;
    surface: {
      canvas: string;
      layer: string;
      layerAlt: string;
      overlay: string;
      border: string;
      text: string;
      textMuted: string;
      focus: string;
      inverseText: string;
    };
  };
  typography: {
    familySans: string;
    familyMono: string;
    size: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    weight: {
      regular: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: string;
      normal: string;
      relaxed: string;
    };
  };
  spacing: {
    0: string;
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    7: string;
    8: string;
    9: string;
    10: string;
    11: string;
    12: string;
  };
  shape: {
    radius: {
      none: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      full: string;
    };
    shadow: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
    zIndex: {
      base: number;
      dropdown: number;
      sticky: number;
      drawer: number;
      modal: number;
      popover: number;
      tooltip: number;
    };
  };
  motion: {
    fast: string;
    normal: string;
    slow: string;
    easingStandard: string;
  };
  density: Density;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const SCALE_STEPS: PaletteStep[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const baseTheme: PlatformTheme = {
  brand: {
    name: 'Platform UI',
  },
  palette: {
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
    warn: {
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
      overlay: 'rgba(13, 22, 39, 0.56)',
      border: '#d9e1eb',
      text: '#152033',
      textMuted: '#4d5d73',
      focus: 'rgba(47, 106, 245, 0.34)',
      inverseText: '#f8fbff',
    },
  },
  typography: {
    familySans:
      '"Plus Jakarta Sans", "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    familyMono: '"IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace',
    size: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: '1.2',
      normal: '1.45',
      relaxed: '1.65',
    },
  },
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    11: '2.75rem',
    12: '3rem',
  },
  shape: {
    radius: {
      none: '0',
      sm: '0.375rem',
      md: '0.625rem',
      lg: '0.875rem',
      xl: '1.125rem',
      full: '9999px',
    },
    shadow: {
      xs: '0 1px 1px rgba(15, 25, 38, 0.06)',
      sm: '0 1px 2px rgba(15, 25, 38, 0.08)',
      md: '0 10px 30px rgba(18, 29, 49, 0.12)',
      lg: '0 14px 42px rgba(18, 29, 49, 0.18)',
      xl: '0 24px 70px rgba(18, 29, 49, 0.22)',
    },
    zIndex: {
      base: 1,
      dropdown: 1000,
      sticky: 1020,
      drawer: 1080,
      modal: 1140,
      popover: 1200,
      tooltip: 1260,
    },
  },
  motion: {
    fast: '120ms',
    normal: '200ms',
    slow: '320ms',
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  density: 'comfortable',
};

const darkThemeOverlay: DeepPartial<PlatformTheme> = {
  palette: {
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
    warn: {
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
      overlay: 'rgba(7, 11, 18, 0.72)',
      border: '#2d3a4f',
      text: '#e7eef9',
      textMuted: '#a6b4cb',
      focus: 'rgba(79, 140, 255, 0.4)',
      inverseText: '#0f1728',
    },
  },
};

export const defaultTheme: PlatformTheme = baseTheme;
export const defaultDarkTheme = createPlatformTheme(darkThemeOverlay, baseTheme);

export function createPlatformTheme(
  overrides: DeepPartial<PlatformTheme> = {},
  base: PlatformTheme = baseTheme,
): PlatformTheme {
  return deepMerge(base, overrides);
}

export function compileThemeToCssVariables(theme: PlatformTheme): Record<string, string> {
  const vars: Record<string, string> = {
    '--pf-font-sans': theme.typography.familySans,
    '--pf-font-mono': theme.typography.familyMono,
    '--pf-font-size-xs': theme.typography.size.xs,
    '--pf-font-size-sm': theme.typography.size.sm,
    '--pf-font-size-md': theme.typography.size.md,
    '--pf-font-size-lg': theme.typography.size.lg,
    '--pf-font-size-xl': theme.typography.size.xl,
    '--pf-font-size-2xl': theme.typography.size['2xl'],
    '--pf-font-size-3xl': theme.typography.size['3xl'],
    '--pf-font-weight-regular': String(theme.typography.weight.regular),
    '--pf-font-weight-medium': String(theme.typography.weight.medium),
    '--pf-font-weight-semibold': String(theme.typography.weight.semibold),
    '--pf-font-weight-bold': String(theme.typography.weight.bold),
    '--pf-line-height-tight': theme.typography.lineHeight.tight,
    '--pf-line-height-normal': theme.typography.lineHeight.normal,
    '--pf-line-height-relaxed': theme.typography.lineHeight.relaxed,
    '--pf-surface-canvas': theme.palette.surface.canvas,
    '--pf-surface-layer': theme.palette.surface.layer,
    '--pf-surface-layer-alt': theme.palette.surface.layerAlt,
    '--pf-surface-overlay': theme.palette.surface.overlay,
    '--pf-surface-border': theme.palette.surface.border,
    '--pf-surface-text': theme.palette.surface.text,
    '--pf-surface-text-muted': theme.palette.surface.textMuted,
    '--pf-surface-focus': theme.palette.surface.focus,
    '--pf-surface-inverse-text': theme.palette.surface.inverseText,
    '--pf-radius-none': theme.shape.radius.none,
    '--pf-radius-sm': theme.shape.radius.sm,
    '--pf-radius-md': theme.shape.radius.md,
    '--pf-radius-lg': theme.shape.radius.lg,
    '--pf-radius-xl': theme.shape.radius.xl,
    '--pf-radius-full': theme.shape.radius.full,
    '--pf-shadow-xs': theme.shape.shadow.xs,
    '--pf-shadow-sm': theme.shape.shadow.sm,
    '--pf-shadow-md': theme.shape.shadow.md,
    '--pf-shadow-lg': theme.shape.shadow.lg,
    '--pf-shadow-xl': theme.shape.shadow.xl,
    '--pf-z-base': String(theme.shape.zIndex.base),
    '--pf-z-dropdown': String(theme.shape.zIndex.dropdown),
    '--pf-z-sticky': String(theme.shape.zIndex.sticky),
    '--pf-z-drawer': String(theme.shape.zIndex.drawer),
    '--pf-z-modal': String(theme.shape.zIndex.modal),
    '--pf-z-popover': String(theme.shape.zIndex.popover),
    '--pf-z-tooltip': String(theme.shape.zIndex.tooltip),
    '--pf-motion-fast': theme.motion.fast,
    '--pf-motion-normal': theme.motion.normal,
    '--pf-motion-slow': theme.motion.slow,
    '--pf-motion-easing-standard': theme.motion.easingStandard,
    '--pf-transition-standard': `all ${theme.motion.normal} ${theme.motion.easingStandard}`,
    '--pf-density': theme.density,
    '--pf-density-scale': theme.density === 'compact' ? '0.87' : '1',
  };

  appendColorScaleVars(vars, 'primary', theme.palette.primary);
  appendColorScaleVars(vars, 'secondary', theme.palette.secondary);
  appendColorScaleVars(vars, 'neutral', theme.palette.neutral);
  appendColorScaleVars(vars, 'success', theme.palette.success);
  appendColorScaleVars(vars, 'warn', theme.palette.warn);
  appendColorScaleVars(vars, 'error', theme.palette.error);

  for (const [spaceKey, spaceValue] of Object.entries(theme.spacing)) {
    vars[`--pf-space-${spaceKey}`] = spaceValue;
  }

  return vars;
}

export function toCssDeclarationBlock(variables: Record<string, string>): string {
  return Object.entries(variables)
    .map(([name, value]) => `${name}: ${value};`)
    .join('\n');
}

function appendColorScaleVars(target: Record<string, string>, name: string, scale: ColorScale): void {
  for (const step of SCALE_STEPS) {
    target[`--pf-color-${name}-${step}`] = scale[step];
  }
}

function deepMerge<T>(base: T, overrides: DeepPartial<T>): T {
  return deepMergeInternal(base, overrides) as T;
}

function deepMergeInternal(base: unknown, overrides: unknown): unknown {
  if (overrides === undefined) return base;
  if (!isObject(base) || !isObject(overrides)) {
    return overrides;
  }

  const merged: Record<string, unknown> = { ...base };
  for (const [key, overrideValue] of Object.entries(overrides)) {
    if (overrideValue === undefined) continue;
    const baseValue = merged[key];
    merged[key] = deepMergeInternal(baseValue, overrideValue);
  }
  return merged;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
