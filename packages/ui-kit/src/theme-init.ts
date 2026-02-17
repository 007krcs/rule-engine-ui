const DEFAULT_STORAGE_KEY = 'pf:theme:v1';

export const platformThemeInitScript = `
(() => {
  try {
    const raw = window.localStorage.getItem('${DEFAULT_STORAGE_KEY}');
    const stored = raw ? JSON.parse(raw) : null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const mode = stored?.mode === 'dark' || stored?.mode === 'light'
      ? stored.mode
      : (prefersDark ? 'dark' : 'light');

    const density = stored?.density === 'compact'
      ? 'compact'
      : (stored?.density === 'cozy' ? 'cozy' : 'comfortable');

    const visual = stored?.visual === 'flat' || stored?.visual === '3d' || stored?.visual === 'layered'
      ? stored.visual
      : 'layered';

    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-density', density);
    root.setAttribute('data-visual', visual);
  } catch {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-density', 'comfortable');
    root.setAttribute('data-visual', 'layered');
  }
})();
`;
