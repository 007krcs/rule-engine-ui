import defaultLightTokens from './default-light.json';
import defaultDarkTokens from './default-dark.json';

export type ThemeMode = 'light' | 'dark';
export type TokenValue = string | number;

export interface TokenDefinition {
  value: TokenValue;
  description?: string;
  type?: 'color' | 'size' | 'font' | 'radius' | 'shadow' | 'spacing' | 'zIndex' | 'other';
}

export type TokenMap = Record<string, TokenDefinition>;
export type TokenValues = Record<string, TokenValue>;

export const defaultLightTokenMap = defaultLightTokens as TokenMap;
export const defaultDarkTokenMap = defaultDarkTokens as TokenMap;

export const defaultLightTheme: TokenValues = tokenMapToValues(defaultLightTokenMap);
export const defaultDarkTheme: TokenValues = tokenMapToValues(defaultDarkTokenMap);

export function tokenMapToValues(map: TokenMap): TokenValues {
  const values: TokenValues = {};
  for (const [key, def] of Object.entries(map)) {
    values[key] = def.value;
  }
  return values;
}

export function mergeTokenValues(base: TokenValues, overrides?: TokenValues | null): TokenValues {
  if (!overrides) return { ...base };
  return { ...base, ...overrides };
}

export function tokenKeyToCssVar(tokenKey: string, prefix = '--dt'): string {
  const parts = tokenKey.split('.').map((part) => toKebabCase(part));
  return `${prefix}-${parts.join('-')}`;
}

export function tokenValuesToCssVars(values: TokenValues, prefix = '--dt'): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    vars[tokenKeyToCssVar(key, prefix)] = String(value);
  }
  return vars;
}

export function applyThemeTokens(target: HTMLElement, values: TokenValues, prefix = '--dt'): void {
  const vars = tokenValuesToCssVars(values, prefix);
  for (const [name, value] of Object.entries(vars)) {
    target.style.setProperty(name, value);
  }
}

export function themeTokensToCss(values: TokenValues, selector = ':root', prefix = '--dt'): string {
  const vars = tokenValuesToCssVars(values, prefix);
  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

function toKebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
}
