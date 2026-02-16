const DEFAULT_STORAGE_KEY = 'pf:theme:v1';

export const platformThemeInitScript = `
(() => {
  try {
    const raw = window.localStorage.getItem('${DEFAULT_STORAGE_KEY}');
    const stored = raw ? JSON.parse(raw) : null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = stored?.mode === 'dark' || stored?.mode === 'light' ? stored.mode : (prefersDark ? 'dark' : 'light');
    const density = stored?.density === 'compact' ? 'compact' : 'comfortable';
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-density', density);
  } catch {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-density', 'comfortable');
  }
})();
`;

