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

test('creates visual rule and verifies matched explain output in playground', async ({ page, request }) => {
  const createdPackage = await request.post('/api/config-packages', {
    data: { name: 'Visual Rules E2E Package' },
  });
  expect(createdPackage.ok()).toBeTruthy();
  const created = (await createdPackage.json()) as { ok: true; versionId: string };

  await page.goto(`/builder/rules?versionId=${encodeURIComponent(created.versionId)}`);
  await waitForClientReady(page);
  await expect(page.getByRole('button', { name: 'Reload', exact: true })).toBeEnabled();

  await page.getByTestId('rule-id-input').fill('DISABLE_SUBMIT_UNTIL_CUSTOMER');

  await page.getByTestId('condition-op-select').first().selectOption('neq');
  await page.getByTestId('condition-left-source').first().selectOption('data');
  await page.getByTestId('condition-left-key').first().fill('customerName');
  await page.getByTestId('condition-right-value').first().fill('null');

  await page.getByTestId('action-path-input').first().fill('data.submitDisabled');
  await page.getByTestId('action-value-input').first().fill('true');

  await expect(page.getByTestId('rules-save-button')).toBeEnabled();
  await page.getByTestId('rules-save-button').click();
  await expect(page.getByTestId('rules-save-button')).toHaveText('Save', { timeout: 30_000 });

  await page.goto(`/playground?versionId=${encodeURIComponent(created.versionId)}&explain=1`);
  await waitForClientReady(page);

  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  const explainCard = page.getByTestId('rule-explain-DISABLE_SUBMIT_UNTIL_CUSTOMER');
  await expect(explainCard).toBeVisible();
  await expect(explainCard.locator('summary')).toContainText('Matched');
});
