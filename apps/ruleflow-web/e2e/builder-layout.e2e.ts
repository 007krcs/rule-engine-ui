import { expect, test, type Locator, type Page } from '@playwright/test';

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

async function dragPaletteInputToViewport(page: Page) {
  const paletteItem = page.getByTestId('palette-item-platform-textField');
  const viewport = page.getByTestId('builder-canvas-viewport');
  await expect(paletteItem).toBeVisible();
  await expect(paletteItem).toBeEnabled();
  await expect(viewport).toBeVisible();
  await paletteItem.scrollIntoViewIfNeeded();
  await viewport.scrollIntoViewIfNeeded();

  const paletteBox = await paletteItem.boundingBox();
  const viewportBox = await viewport.boundingBox();
  if (!paletteBox || !viewportBox) {
    throw new Error('Missing bounding boxes for builder drag operation.');
  }

  await page.mouse.move(paletteBox.x + paletteBox.width / 2, paletteBox.y + paletteBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewportBox.x + viewportBox.width * 0.38, viewportBox.y + viewportBox.height * 0.52, {
    steps: 18,
  });
  await page.mouse.up();
}

async function listCanvasItemIds(page: Page): Promise<string[]> {
  const nodes = page.locator('[data-testid^="builder-grid-item-"]');
  const ids = await nodes.evaluateAll((elements) =>
    elements
      .map((el) => el.getAttribute('data-testid') ?? '')
      .filter((value) => value.startsWith('builder-grid-item-'))
      .map((value) => value.replace(/^builder-grid-item-/, '')),
  );
  return ids.sort();
}

async function waitForDroppedComponentId(page: Page, before: string[]): Promise<string | null> {
  const beforeSet = new Set(before);
  try {
    await expect.poll(async () => {
      const now = await listCanvasItemIds(page);
      return now.find((id) => !beforeSet.has(id)) ?? '';
    }).not.toBe('');
  } catch {
    return null;
  }
  const now = await listCanvasItemIds(page);
  return now.find((id) => !beforeSet.has(id)) ?? null;
}

async function addComponentViaQuickAdd(page: Page): Promise<string> {
  const id = `input${Date.now().toString().slice(-6)}`;
  await page.getByTestId('palette-item-platform-textField').click();
  await page.getByTestId('builder-quick-add-id').fill(id);
  await page.getByTestId('builder-quick-add-button').click();
  await expect(page.getByTestId(`builder-grid-item-${id}`)).toBeVisible({ timeout: 30_000 });
  return id;
}

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function clampToRect(
  target: { x: number; y: number; width: number; height: number },
  bounds: { x: number; y: number; width: number; height: number },
) {
  const left = Math.max(target.x, bounds.x);
  const top = Math.max(target.y, bounds.y);
  const right = Math.min(target.x + target.width, bounds.x + bounds.width);
  const bottom = Math.min(target.y + target.height, bounds.y + bounds.height);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

async function getBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('Expected element bounding box to exist.');
  return box;
}

test('builder shell keeps workspace bounded with independent panes', async ({ page, request }, testInfo) => {
  const create = await request.post('/api/config-packages', {
    data: { name: 'Builder Layout Workspace E2E' },
  });
  expect(create.ok()).toBeTruthy();
  const created = (await create.json()) as { ok: true; versionId: string };

  await page.goto(`/builder?versionId=${encodeURIComponent(created.versionId)}`);
  await waitForClientReady(page);
  await expect(page.getByText('Schema Builder')).toBeVisible();

  const palettePanel = page.getByTestId('builder-palette-panel');
  const canvasViewport = page.getByTestId('builder-canvas-viewport');
  const inspectorPanel = page.getByTestId('builder-inspector-panel');

  await expect(palettePanel).toBeVisible();
  await expect(canvasViewport).toBeVisible();
  await expect(inspectorPanel).toBeVisible();

  const beforeIds = await listCanvasItemIds(page);
  await dragPaletteInputToViewport(page);
  const droppedId = (await waitForDroppedComponentId(page, beforeIds)) ?? (await addComponentViaQuickAdd(page));
  const droppedItem = page.getByTestId(`builder-grid-item-${droppedId}`);
  await expect(droppedItem).toBeVisible();

  await droppedItem.focus();
  await droppedItem.press('Shift+ArrowRight');
  await droppedItem.press('Shift+ArrowDown');
  await droppedItem.scrollIntoViewIfNeeded();

  const viewportRect = await getBox(canvasViewport);
  const paletteRect = await getBox(palettePanel);
  const inspectorRect = await getBox(inspectorPanel);
  const itemRect = await getBox(droppedItem);
  const visibleItemRect = clampToRect(itemRect, viewportRect);

  expect(visibleItemRect.width).toBeGreaterThan(0);
  expect(visibleItemRect.height).toBeGreaterThan(0);
  expect(visibleItemRect.x).toBeGreaterThanOrEqual(viewportRect.x - 1);
  expect(visibleItemRect.y).toBeGreaterThanOrEqual(viewportRect.y - 1);
  expect(visibleItemRect.x + visibleItemRect.width).toBeLessThanOrEqual(viewportRect.x + viewportRect.width + 1);
  expect(visibleItemRect.y + visibleItemRect.height).toBeLessThanOrEqual(viewportRect.y + viewportRect.height + 1);

  expect(rectsIntersect(visibleItemRect, paletteRect)).toBeFalsy();
  expect(rectsIntersect(visibleItemRect, inspectorRect)).toBeFalsy();

  await page.screenshot({ path: testInfo.outputPath('builder-shell-layout.png'), fullPage: true });
});

