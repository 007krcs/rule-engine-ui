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

test('ui-kit page theme controls and accessibility gate', async ({ page }) => {
  await page.goto('/system/ui-kit');
  await waitForClientReady(page);

  await expect(page.getByRole('heading', { name: 'Platform UI Kit' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Theme mode' }).selectOption('dark');
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');

  await page.getByRole('combobox', { name: 'Density mode' }).selectOption('compact');
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-density'))).toBe('compact');

  await page.getByLabel('Brand primary').fill('#0055aa');
  await expect
    .poll(async () =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pf-color-primary-500').trim()),
    )
    .toBe('#0055aa');

  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
  const violations = await page.evaluate(async () => {
    const axe = (window as Window & { axe: { run: (root?: unknown, options?: unknown) => Promise<{ violations: unknown[] }> } }).axe;
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    return results.violations as Array<{ impact: string | null }>;
  });

  const blocking = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking).toEqual([]);
});
