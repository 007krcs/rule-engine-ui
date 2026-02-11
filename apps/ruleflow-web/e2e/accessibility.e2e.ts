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

test('axe scan on home page has no serious or critical violations', async ({ page }) => {
  await page.goto('/');
  await waitForClientReady(page);

  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
  const violations = await page.evaluate(async () => {
    const axe = (window as Window & { axe: { run: (root?: unknown, options?: unknown) => Promise<{ violations: unknown[] }> } })
      .axe;
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    return results.violations as Array<{ id: string; impact: string | null; description: string; nodes: unknown[] }>;
  });

  const blocking = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking).toEqual([]);
});
