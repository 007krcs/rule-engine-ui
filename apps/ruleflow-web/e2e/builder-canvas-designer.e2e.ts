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

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const snapshot = await page
    .evaluate(() => {
      const keys = Object.keys(window.localStorage).filter((key) =>
        key.startsWith('ruleflow:builder:schema:'),
      );
      return keys.map((key) => ({
        key,
        value: window.localStorage.getItem(key),
      }));
    })
    .catch(() => []);

  await testInfo.attach('builder-schema-layout.json', {
    body: Buffer.from(JSON.stringify(snapshot, null, 2)),
    contentType: 'application/json',
  });

  await page.screenshot({
    path: testInfo.outputPath('builder-canvas-designer-failure.png'),
    fullPage: true,
  });
});

async function waitForClientReady(page: Page) {
  await expect(page.getByTestId('client-ready')).toBeVisible({ timeout: 120_000 });
}

function parseMeta(raw: string): { x: number; y: number; w: number; h: number } {
  const match = raw.trim().match(/^(\d+),(\d+)\s+(\d+)x(\d+)$/);
  if (!match) {
    throw new Error(`Unexpected grid meta format: ${raw}`);
  }
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    w: Number(match[3]),
    h: Number(match[4]),
  };
}

async function readMeta(page: Page, componentId: string) {
  const metaNode = page.getByTestId(`builder-grid-item-meta-${componentId}`);
  await expect(metaNode).toBeVisible();
  return parseMeta(await metaNode.innerText());
}

async function drag(page: Page, start: { x: number; y: number }, end: { x: number; y: number }) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 18 });
  await page.mouse.up();
}

test('builder canvas supports artboard sizing, precise resize, zoom-safe drag, and layout inputs', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/builder');
  await waitForClientReady(page);

  await page.getByTestId('builder-artboard-select').selectOption('desktop-1440');
  await expect(page.getByText('1440x900')).toBeVisible();

  const componentId = `layout${Date.now().toString().slice(-5)}`;
  await page.getByTestId('palette-item-platform-dateField').click();
  await page.getByTestId('builder-quick-add-id').fill(componentId);
  await page.getByTestId('builder-quick-add-button').click();
  const newItem = page.getByTestId(`builder-grid-item-${componentId}`);
  await expect(newItem).toBeVisible();
  await newItem.scrollIntoViewIfNeeded();

  const resizeHandle = page.getByTestId(`builder-resize-${componentId}-se`);
  await resizeHandle.scrollIntoViewIfNeeded();
  await expect(resizeHandle).toBeVisible();
  const handleBox = await resizeHandle.boundingBox();
  if (!handleBox) throw new Error('Resize handle box is not available');
  await drag(
    page,
    { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 },
    { x: handleBox.x + 250, y: handleBox.y + 170 },
  );

  await expect.poll(async () => {
    const meta = await readMeta(page, componentId);
    return `${meta.w}x${meta.h}`;
  }).toBe('6x4');

  const customerMeta = await readMeta(page, 'customerName');
  const dragHandle = page.getByTestId(`builder-drag-${componentId}`);
  await dragHandle.scrollIntoViewIfNeeded();
  await expect(dragHandle).toBeVisible();
  const dragBox = await dragHandle.boundingBox();
  if (!dragBox) throw new Error('Drag handle box is not available');

  await drag(
    page,
    { x: dragBox.x + dragBox.width / 2, y: dragBox.y + dragBox.height / 2 },
    { x: dragBox.x + 620, y: dragBox.y - 320 },
  );

  await expect.poll(async () => {
    const moved = await readMeta(page, componentId);
    return moved.y;
  }).toBe(customerMeta.y);

  const beforeZoomMove = await readMeta(page, componentId);
  await page.getByTestId('builder-zoom-input').fill('150');
  await expect(page.getByTestId('builder-zoom-input')).toHaveValue('150');

  const dragHandleAfterZoom = page.getByTestId(`builder-drag-${componentId}`);
  await dragHandleAfterZoom.scrollIntoViewIfNeeded();
  await expect(dragHandleAfterZoom).toBeVisible();
  const dragBoxAfterZoom = await dragHandleAfterZoom.boundingBox();
  if (!dragBoxAfterZoom) throw new Error('Drag handle box is not available after zoom');
  await drag(
    page,
    { x: dragBoxAfterZoom.x + dragBoxAfterZoom.width / 2, y: dragBoxAfterZoom.y + dragBoxAfterZoom.height / 2 },
    { x: dragBoxAfterZoom.x + 140, y: dragBoxAfterZoom.y + dragBoxAfterZoom.height / 2 + 6 },
  );

  const afterZoomMove = await readMeta(page, componentId);
  expect(afterZoomMove.x).toBeGreaterThanOrEqual(beforeZoomMove.x + 1);
  expect(Math.abs(afterZoomMove.y - beforeZoomMove.y)).toBeLessThanOrEqual(1);

  await page.getByTestId('builder-layout-width').fill('7');
  await page.getByTestId('builder-layout-height').fill('5');
  await expect(page.getByTestId('builder-layout-width')).toHaveValue('7');
  await expect(page.getByTestId('builder-layout-height')).toHaveValue('5');
  await expect.poll(async () => {
    const meta = await readMeta(page, componentId);
    return `${meta.w}x${meta.h}`;
  }).toBe('7x5');
});
