import AxeBuilder from '@axe-core/playwright';
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

async function assertNoAxeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  if (results.violations.length > 0) {
    throw new Error(
      `Axe violations on ${label}:\n${JSON.stringify(
        results.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            failureSummary: node.failureSummary,
          })),
        })),
        null,
        2,
      )}`,
    );
  }
}

test('builder has no axe violations', async ({ page }) => {
  await page.goto('/builder');
  await waitForClientReady(page);
  await expect(page.getByTestId('builder-shell')).toBeVisible();
  await assertNoAxeViolations(page, '/builder');
});

test('console has no axe violations', async ({ page }) => {
  await page.goto('/console');
  await waitForClientReady(page);
  await expect(page.getByText('Config Lifecycle')).toBeVisible();
  await assertNoAxeViolations(page, '/console');
});

test('playground has no axe violations', async ({ page }) => {
  await page.goto('/playground');
  await waitForClientReady(page);
  await expect(page.getByTestId('playground-current-state')).toBeVisible();
  await assertNoAxeViolations(page, '/playground');
});

