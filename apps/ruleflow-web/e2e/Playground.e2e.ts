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

test('changing input and submitting updates trace explain output', async ({ page }) => {
  await page.goto('/playground');
  await waitForClientReady(page);

  const orderTotalInput = page.getByLabel('Order total filter');
  await expect(orderTotalInput).toBeVisible();

  await orderTotalInput.fill('1200');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText('State: submitted')).toBeVisible();

  await page.getByLabel('Explain').check();
  const ruleDetails = page.getByTestId('rule-explain-US_ADMIN_DISCOUNT');
  await ruleDetails.locator('summary').click();
  await expect(ruleDetails.getByText('data.orderTotal=1200', { exact: true })).toBeVisible();
  await expect(ruleDetails.getByText('Matched', { exact: true })).toBeVisible();

  await orderTotalInput.fill('500');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText('State: submitted')).toBeVisible();

  await ruleDetails.locator('summary').click();
  await expect(ruleDetails.getByText('data.orderTotal=500', { exact: true })).toBeVisible();
  await expect(ruleDetails.getByText('Not matched', { exact: true })).toBeVisible();
});
