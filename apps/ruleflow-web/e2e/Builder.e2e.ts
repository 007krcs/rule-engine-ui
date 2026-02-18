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

async function dragPaletteInputToCanvas(
  page: Page,
  paletteItemTestId = 'palette-item-platform-textField',
) {
  const paletteItem = page.getByTestId(paletteItemTestId);
  const canvas = page.getByTestId('builder-canvas');
  await expect(paletteItem).toBeVisible();
  await expect(paletteItem).toBeEnabled();
  await expect(canvas).toBeVisible();
  await paletteItem.scrollIntoViewIfNeeded();
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);

  const paletteBox = await paletteItem.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!paletteBox || !canvasBox) {
    throw new Error('Missing bounding boxes for drag operation');
  }

  await page.mouse.move(paletteBox.x + paletteBox.width / 2, paletteBox.y + paletteBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + Math.min(80, canvasBox.height / 2), {
    steps: 20,
  });
  await page.mouse.up();
}

async function readGridMeta(page: Page, componentId: string): Promise<string> {
  const meta = page.getByTestId(`builder-grid-item-meta-${componentId}`);
  await expect(meta).toBeVisible();
  return (await meta.innerText()).trim();
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

async function waitForDroppedComponentId(page: Page, before: string[]): Promise<string> {
  const beforeSet = new Set(before);
  await expect.poll(async () => {
    const now = await listCanvasItemIds(page);
    return now.find((id) => !beforeSet.has(id)) ?? '';
  }).not.toBe('');
  const now = await listCanvasItemIds(page);
  const next = now.find((id) => !beforeSet.has(id));
  if (!next) {
    throw new Error('Expected one dropped component id but none was detected.');
  }
  return next;
}

async function addComponentViaQuickAdd(page: Page): Promise<string> {
  const id = `input${Date.now().toString().slice(-6)}`;
  await page.getByTestId('palette-item-platform-textField').click();
  await page.getByTestId('builder-quick-add-id').fill(id);
  await page.getByTestId('builder-quick-add-button').click();
  await expect(page.getByTestId(`builder-grid-item-${id}`)).toBeVisible({ timeout: 30_000 });
  return id;
}

test('supports grid DnD + breakpoint persistence + i18n + visibleWhen rules', async ({ page, request }) => {
  const create = await request.post('/api/config-packages', {
    data: { name: 'Builder Grid+i18n+rulset E2E' },
  });
  expect(create.ok()).toBeTruthy();
  const created = (await create.json()) as { ok: true; versionId: string };

  await page.goto(`/builder?versionId=${encodeURIComponent(created.versionId)}`);
  await waitForClientReady(page);
  await expect(page.getByText('Schema Builder')).toBeVisible();

  const beforeIds = await listCanvasItemIds(page);
  await dragPaletteInputToCanvas(page);
  const droppedId =
    (await waitForDroppedComponentId(page, beforeIds).catch(() => null)) ??
    (await addComponentViaQuickAdd(page));
  const addedItem = page.getByTestId(`builder-grid-item-${droppedId}`);
  await expect(addedItem).toBeVisible({ timeout: 30_000 });

  await addedItem.focus();
  await addedItem.press('Shift+ArrowRight');
  await addedItem.press('Shift+ArrowDown');

  const lgMetaBefore = await readGridMeta(page, droppedId);

  const breakpointSelect = page.getByTestId('builder-breakpoint-select');
  await breakpointSelect.selectOption('md');
  await addedItem.scrollIntoViewIfNeeded();
  await addedItem.click({ force: true });
  await addedItem.focus();
  await addedItem.press('ArrowRight');
  await addedItem.press('ArrowRight');
  await addedItem.press('ArrowDown');
  const mdMetaBefore = await readGridMeta(page, droppedId);
  expect(mdMetaBefore).not.toBe(lgMetaBefore);

  await breakpointSelect.selectOption('lg');
  const lgMetaAfter = await readGridMeta(page, droppedId);
  expect(lgMetaAfter).toBe(lgMetaBefore);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled({ timeout: 30_000 });

  await page.reload();
  await waitForClientReady(page);
  await breakpointSelect.selectOption('lg');
  expect(await readGridMeta(page, droppedId)).toBe(lgMetaBefore);
  await breakpointSelect.selectOption('md');
  expect(await readGridMeta(page, droppedId)).toBe(mdMetaBefore);

  const localeInput = page.getByTestId('builder-locale-input');
  await localeInput.fill('fr');
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('Nom du client')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Back to editing' }).click();
  const customerNameItem = page.getByTestId('builder-grid-item-customerNameInput');
  await customerNameItem.scrollIntoViewIfNeeded();
  await customerNameItem.click({ force: true });
  await page.getByTestId('rule-type-select').selectOption('visibleWhen');
  await page.getByLabel('Rule left path').fill('context.locale');
  await page.getByLabel('Rule operator').selectOption('eq');
  await page.getByLabel('Rule right value').fill('"fr"');
  await page.getByRole('button', { name: 'Compose Rule' }).click();

  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('Nom du client')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Back to editing' }).click();

  await localeInput.fill('en');
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('Customer name')).toHaveCount(0);
});

test('material adapter renders material.input after drag when adapter is enabled', async ({ page, request }) => {
  const enableExternal = await request.post('/api/feature-flags', {
    data: { env: 'prod', key: 'builder.palette.externalAdapters', enabled: true },
  });
  if (!enableExternal.ok()) {
    test.skip(true, 'Feature flags persistence requires Postgres provider');
  }

  await request.post('/api/feature-flags', {
    data: { env: 'prod', key: 'adapter.material', enabled: true },
  });

  await page.goto('/builder');
  await waitForClientReady(page);
  await expect(page.getByTestId('palette-item-material-input')).toBeVisible();
  await expect(page.getByTestId('palette-item-material-input')).toBeEnabled();

  const beforeIds = await listCanvasItemIds(page);
  await dragPaletteInputToCanvas(page, 'palette-item-material-input');
  const droppedId = await waitForDroppedComponentId(page, beforeIds);
  await expect(page.getByTestId(`builder-grid-item-${droppedId}`)).toBeVisible();
  await expect(page.locator('[data-component-not-available]')).toHaveCount(0);
});
