import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ request, page }) => {
  await request.post('/api/system/reset');
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'rf:onboarding:v1',
        JSON.stringify({ open: false, dismissed: true, activeVersionId: null, steps: {} }),
      );
    } catch {
      // ignore
    }
  });
});

async function waitForClientReady(page: Page) {
  await expect(page.getByTestId('client-ready')).toBeVisible({ timeout: 120_000 });
}

test('theme studio applies 3d style and builder keeps readable artboard', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/system/theme-studio');
  await waitForClientReady(page);

  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Theme Studio' })).toBeVisible();

  await page.getByTestId('theme-studio-mode').selectOption('dark');
  await page.getByTestId('theme-studio-density').selectOption('compact');
  await page.getByTestId('theme-studio-visual').selectOption('3d');
  await page.getByTestId('theme-studio-primary').fill('#1258e5');
  await page.getByTestId('theme-studio-secondary').fill('#6f3bd6');

  await expect
    .poll(async () =>
      page.evaluate(() => ({
        rootVisual: document.documentElement.getAttribute('data-visual'),
        bodyVisual: document.body.getAttribute('data-visual'),
      })),
    )
    .toEqual({ rootVisual: '3d', bodyVisual: '3d' });

  const contrastRatio = await page.evaluate(() => {
    const parseColor = (raw: string): [number, number, number] => {
      const value = raw.trim();
      if (value.startsWith('#')) {
        const normalized = value.length === 4
          ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
          : value;
        const hex = normalized.slice(1);
        return [
          Number.parseInt(hex.slice(0, 2), 16),
          Number.parseInt(hex.slice(2, 4), 16),
          Number.parseInt(hex.slice(4, 6), 16),
        ];
      }
      const matches = value.match(/\d+/g);
      if (!matches || matches.length < 3) return [0, 0, 0];
      return [Number(matches[0]), Number(matches[1]), Number(matches[2])];
    };

    const luminance = ([r, g, b]: [number, number, number]): number => {
      const toLinear = (channel: number): number => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };

    const rootStyles = getComputedStyle(document.documentElement);
    const fg = parseColor(rootStyles.getPropertyValue('--pf-surface-text'));
    const bg = parseColor(rootStyles.getPropertyValue('--pf-surface-layer'));
    const light = Math.max(luminance(fg), luminance(bg));
    const dark = Math.min(luminance(fg), luminance(bg));
    return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
  });

  expect(contrastRatio).toBeGreaterThan(4.5);

  await page.getByTestId('theme-studio-save').click();

  await page.goto('/builder');
  await waitForClientReady(page);
  await expect(page.getByText('Schema Builder')).toBeVisible();

  const workspace = page.getByTestId('builder-canvas-workspace');
  const artboard = page.getByTestId('builder-grid-canvas');

  const workspaceBackground = await workspace.evaluate((node) => getComputedStyle(node).backgroundImage);
  expect(workspaceBackground).toContain('gradient');

  const artboardBackground = await artboard.evaluate((node) => {
    const styles = getComputedStyle(node);
    return {
      color: styles.backgroundColor,
      image: styles.backgroundImage,
    };
  });
  const hasReadableArtboard =
    artboardBackground.color !== 'rgba(0, 0, 0, 0)' || artboardBackground.image !== 'none';
  expect(hasReadableArtboard).toBe(true);

  await page.screenshot({
    path: testInfo.outputPath('theme-studio-3d-builder.png'),
    fullPage: false,
  });
});
