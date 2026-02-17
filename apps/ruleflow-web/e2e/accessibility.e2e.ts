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

async function runAxe(page: Page) {
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
  const violations = await page.evaluate(async () => {
    const axeWindow = window as unknown as { axe: { run: (root?: unknown, options?: unknown) => Promise<{ violations: unknown[] }> } };
    const axe = axeWindow.axe;
    
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    return results.violations as Array<{ id: string; impact: string | null; description: string; nodes: unknown[] }>;
  });

  const blocking = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking).toEqual([]);
}

test('axe scan on home page has no serious or critical violations', async ({ page }) => {
  await page.goto('/');
  await waitForClientReady(page);
  await runAxe(page);
});

test('axe scan on builder page has no serious or critical violations', async ({ page }) => {
  await page.goto('/builder');
  await waitForClientReady(page);
  await expect(page.getByText('Schema Builder')).toBeVisible();
  await runAxe(page);
});

test('axe scan on translation editor has no serious or critical violations', async ({ page }) => {
  await page.goto('/system/translations');
  await waitForClientReady(page);
  await expect(page.getByText('Translation Editor')).toBeVisible();
  await runAxe(page);
});

test('axe scan on theme studio has no serious or critical violations', async ({ page }) => {
  await page.goto('/system/theme-studio');
  await waitForClientReady(page);
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Theme Studio' })).toBeVisible();
  await runAxe(page);
});
