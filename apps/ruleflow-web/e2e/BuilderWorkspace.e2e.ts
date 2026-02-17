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

test('resizes builder panels, persists widths, and resets layout', async ({ page }) => {
  await page.goto('/builder');
  await waitForClientReady(page);
  await expect(page.getByText('Schema Builder')).toBeVisible();

  const palette = page.getByTestId('builder-palette-panel');
  const splitter = page.getByTestId('builder-splitter-left');
  await expect(palette).toBeVisible();
  await expect(splitter).toBeVisible();

  const before = await palette.boundingBox();
  if (!before) throw new Error('Palette bounding box not available');

  await splitter.focus();
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('ArrowRight');
  }

  const afterResize = await palette.boundingBox();
  if (!afterResize) throw new Error('Palette bounding box not available after resize');
  expect(afterResize.width).toBeGreaterThan(before.width + 40);

  await page.reload();
  await waitForClientReady(page);
  const afterReload = await page.getByTestId('builder-palette-panel').boundingBox();
  if (!afterReload) throw new Error('Palette bounding box not available after reload');
  expect(afterReload.width).toBeGreaterThan(before.width + 40);

  await page.getByTestId('builder-reset-layout').click();
  const afterReset = await page.getByTestId('builder-palette-panel').boundingBox();
  if (!afterReset) throw new Error('Palette bounding box not available after reset');
  expect(afterReset.width).toBeLessThan(afterReload.width - 30);
});

test('adds a platform date field and renders it in preview', async ({ page }) => {
  await page.goto('/builder');
  await waitForClientReady(page);

  await expect(page.getByTestId('palette-item-platform-dateField')).toBeVisible();
  await page.getByTestId('palette-item-platform-dateField').click();

  const componentId = `startDate${Date.now().toString().slice(-5)}`;
  await page.getByTestId('builder-quick-add-id').fill(componentId);
  await page.getByTestId('builder-quick-add-button').click();
  await expect(page.getByTestId(`builder-grid-item-${componentId}`)).toBeVisible();

  await page.getByTestId(`builder-grid-item-${componentId}`).click();
  await expect(page.getByTestId('builder-inspector-panel').getByText('Data Binding')).toBeVisible();

  await page
    .getByTestId('builder-inspector-panel')
    .getByPlaceholder('data.customer.appointmentDate')
    .fill('data.form.startDate');
  await page
    .getByTestId('builder-inspector-panel')
    .locator('label:has-text("Required field") input[type="checkbox"]')
    .first()
    .check();

  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.locator('input[type="date"]').first()).toBeVisible();
});
