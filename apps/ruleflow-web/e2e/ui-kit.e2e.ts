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

test('ui-kit explorer supports search, preview controls, and theme toolbar', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/system/ui-kit');
  await waitForClientReady(page);

  await expect(page.getByRole('heading', { name: 'Component Explorer' })).toBeVisible();

  await page.getByTestId('ui-kit-search-input').fill('dialog');
  await expect(page.getByTestId('ui-kit-item-platform.dialog')).toBeVisible();
  await page.getByTestId('ui-kit-item-platform.dialog').click();

  await expect(page.getByRole('heading', { name: 'PFDialog' })).toBeVisible();
  await expect(page.getByTestId('ui-kit-preview')).toBeVisible();

  await page.getByTestId('ui-kit-prop-open').evaluate((node) => {
    (node as HTMLInputElement).click();
  });
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByTestId('ui-kit-theme-mode').selectOption('dark');
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');

  await page.getByTestId('ui-kit-density-mode').selectOption('compact');
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-density'))).toBe('compact');

  await page.getByTestId('ui-kit-brand-primary').fill('#0055aa');
  await expect
    .poll(async () =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pf-color-primary-500').trim()),
    )
    .toBe('#0055aa');

  await page.screenshot({
    path: testInfo.outputPath('ui-kit-explorer-1366x768.png'),
    fullPage: false,
  });
});
