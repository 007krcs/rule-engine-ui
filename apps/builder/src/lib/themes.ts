import type { ThemeMode, TokenValues } from '@platform/design-tokens';

export interface TenantThemeDefinition {
  id: string;
  name: string;
  modes: Partial<Record<ThemeMode, TokenValues>>;
}

export const acmeTheme: TenantThemeDefinition = {
  id: 'acme-corp',
  name: 'Acme Corp',
  modes: {
    light: {
      'color.primary': '#ff6b00',
      'color.primaryHover': '#e85a00',
      'color.surface': '#ffffff',
      'color.border': '#f2c0a3',
      'color.text': '#2a1b12',
    },
    dark: {
      'color.primary': '#ff9447',
      'color.primaryHover': '#ff7f1f',
      'color.surface': '#1a0f0b',
      'color.border': '#3a251b',
      'color.text': '#f7e5d8',
    },
  },
};

export const builderTenantTheme = acmeTheme;
