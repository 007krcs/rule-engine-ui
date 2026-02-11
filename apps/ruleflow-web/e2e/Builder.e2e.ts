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

test('drag component, reorder via keyboard, and save config', async ({ page, request }) => {
  const create = await request.post('/api/config-packages', { data: { name: 'QA Builder E2E Package' } });
  expect(create.ok()).toBeTruthy();
  const created = (await create.json()) as { ok: true; versionId: string };
  const versionId = created.versionId;

  await page.goto(`/builder?versionId=${encodeURIComponent(versionId)}`);
  await waitForClientReady(page);
  await expect(page.getByText('Schema Builder')).toBeVisible();
  await expect(page.locator('[data-testid^="canvas-item-"]').first()).toBeVisible();

  const paletteItem = page.getByTestId('palette-item-material-input');
  const canvas = page.getByTestId('builder-canvas');
  await expect(paletteItem).toBeVisible();
  await paletteItem.scrollIntoViewIfNeeded();
  await canvas.scrollIntoViewIfNeeded();

  const paletteBox = await paletteItem.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!paletteBox || !canvasBox) throw new Error('Missing bounding box for drag-drop operation');

  await page.mouse.move(paletteBox.x + paletteBox.width / 2, paletteBox.y + paletteBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + Math.min(100, canvasBox.height / 2), { steps: 15 });
  await page.mouse.up();

  await expect(page.getByTestId('canvas-item-input')).toBeVisible({ timeout: 30_000 });

  const beforeOrder = await page.$$eval('[data-testid^="canvas-item-"]', (items) =>
    items.map((item) => item.getAttribute('data-testid') ?? ''),
  );
  expect(beforeOrder.length).toBeGreaterThan(1);

  const secondId = beforeOrder[1]?.replace('canvas-item-', '');
  if (!secondId) throw new Error('Unable to resolve second canvas item id');

  const moveUp = page.getByTestId(`canvas-move-up-${secondId}`);
  await expect(moveUp).toBeVisible();
  await moveUp.focus();
  await moveUp.press('Enter');

  const afterOrder = await page.$$eval('[data-testid^="canvas-item-"]', (items) =>
    items.map((item) => item.getAttribute('data-testid') ?? ''),
  );
  expect(afterOrder[0]).toBe(`canvas-item-${secondId}`);

  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Saved UI schema')).toBeVisible();

  await page.reload();
  await waitForClientReady(page);
  await expect(page.getByText('Schema Builder')).toBeVisible();

  const persistedOrder = await page.$$eval('[data-testid^="canvas-item-"]', (items) =>
    items.map((item) => item.getAttribute('data-testid') ?? ''),
  );
  expect(persistedOrder[0]).toBe(`canvas-item-${secondId}`);
});
