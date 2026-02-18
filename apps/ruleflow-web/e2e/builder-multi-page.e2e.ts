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

test('supports multi-page uiSchemas and flow state page bindings', async ({ page, request }) => {
  const createdPackage = await request.post('/api/config-packages', {
    data: { name: 'Builder Multi Page E2E' },
  });
  expect(createdPackage.ok()).toBeTruthy();
  const created = (await createdPackage.json()) as { ok: true; versionId: string };

  await page.goto(`/builder?versionId=${encodeURIComponent(created.versionId)}`);
  await waitForClientReady(page);
  await expect(page.getByRole('button', { name: 'Reload' })).toBeEnabled();

  const pageSwitcher = page.getByTestId('builder-page-switcher');
  await expect(pageSwitcher).toBeVisible();
  const initialPageId = await pageSwitcher.inputValue();

  await page.getByTestId('builder-new-page-id').fill('details');
  await page.getByTestId('builder-page-add').click();
  const secondPageId = await pageSwitcher.inputValue();
  expect(secondPageId).not.toBe(initialPageId);

  await pageSwitcher.selectOption(initialPageId);
  await page.getByTestId('palette-item-platform-textField').click();
  await page.getByTestId('builder-quick-add-id').fill('ordersPageField');
  await page.getByTestId('builder-quick-add-button').click();
  await expect(page.getByTestId('builder-grid-item-ordersPageField')).toBeVisible();

  await pageSwitcher.selectOption(secondPageId);
  await page.getByTestId('palette-item-platform-textField').click();
  await page.getByTestId('builder-quick-add-id').fill('detailsPageField');
  await page.getByTestId('builder-quick-add-button').click();
  await expect(page.getByTestId('builder-grid-item-detailsPageField')).toBeVisible();

  await page.getByTestId('builder-flow-state-page-start').selectOption(initialPageId);
  await page.getByTestId('builder-flow-state-page-details').selectOption(secondPageId);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

  await page.goto(`/playground?versionId=${encodeURIComponent(created.versionId)}`);
  await waitForClientReady(page);

  await expect(page.locator('[data-component-id="ordersPageField"]')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('[data-component-id="detailsPageField"]')).toBeVisible();
  await expect(page.locator('[data-component-id="ordersPageField"]')).toHaveCount(0);
});
