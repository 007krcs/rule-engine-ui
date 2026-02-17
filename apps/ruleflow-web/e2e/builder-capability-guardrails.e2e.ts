import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

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

async function dragPaletteItemToCanvas(page: Page, testId: string) {
  const paletteItem = page.getByTestId(testId);
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

async function waitForDroppedComponentId(page: Page, before: string[]): Promise<string | null> {
  const beforeSet = new Set(before);
  await expect
    .poll(async () => {
      const now = await listCanvasItemIds(page);
      return now.find((id) => !beforeSet.has(id)) ?? '';
    }, { timeout: 12_000 })
    .not.toBe('');
  const now = await listCanvasItemIds(page);
  return now.find((id) => !beforeSet.has(id)) ?? null;
}

async function createPackageVersion(request: APIRequestContext, name: string): Promise<string> {
  const response = await request.post('/api/config-packages', {
    data: { name },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { ok: true; versionId: string };
  return payload.versionId;
}

test('enforces planned palette guardrails and supports unsupported placeholder recovery', async ({
  page,
  request,
}) => {
  const versionId = await createPackageVersion(request, 'Builder Capability Guardrails');
  await page.goto(`/builder?versionId=${encodeURIComponent(versionId)}`);
  await waitForClientReady(page);
  await expect(page.getByText('Schema Builder')).toBeVisible();

  await expect(page.getByTestId('palette-item-platform-svgIcon')).toHaveCount(0);
  await page.getByTestId('builder-toggle-show-planned').check();
  const plannedItem = page.getByTestId('palette-item-platform-svgIcon');
  await expect(plannedItem).toBeVisible();
  await expect(plannedItem).toBeDisabled();

  const beforeIds = await listCanvasItemIds(page);
  await dragPaletteItemToCanvas(page, 'palette-item-platform-chip');
  const droppedId = await waitForDroppedComponentId(page, beforeIds);
  expect(droppedId).not.toBeNull();
  await expect(page.getByText('Unsupported platform component: platform.chip')).toHaveCount(0);
  await expect(page.getByTestId(`builder-grid-item-${droppedId!}`)).toBeVisible();

  const versionResponse = await request.get(`/api/config-versions/${encodeURIComponent(versionId)}`);
  expect(versionResponse.ok()).toBeTruthy();
  const versionPayload = (await versionResponse.json()) as {
    ok: true;
    version: { bundle: { uiSchema: Record<string, unknown> } };
  };
  const schema = versionPayload.version.bundle.uiSchema as {
    components?: Array<Record<string, unknown>>;
    items?: Array<Record<string, unknown>>;
  };

  const nextComponent = {
    id: 'unsupportedPlatformWidget',
    type: 'custom',
    adapterHint: 'platform.fakeUnsupported',
    props: { label: 'Unsupported' },
    accessibility: {
      ariaLabelKey: 'runtime.unsupportedPlatformWidget.aria',
      keyboardNav: true,
      focusOrder: 200,
    },
  };

  const nextItem = {
    id: 'unsupportedPlatformWidget-item',
    componentId: 'unsupportedPlatformWidget',
    x: 0,
    y: 8,
    w: 4,
    h: 2,
  };

  const patchedSchema = {
    ...schema,
    components: [...(schema.components ?? []), nextComponent],
    items: [...(schema.items ?? []), nextItem],
  };

  const patchResponse = await request.patch(`/api/config-versions/${encodeURIComponent(versionId)}`, {
    data: { uiSchema: patchedSchema },
  });
  expect(patchResponse.ok()).toBeTruthy();

  await page.reload();
  await waitForClientReady(page);
  await expect(page.getByText('Component not enabled')).toBeVisible();
  await expect(page.locator('code', { hasText: 'platform.fakeUnsupported' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replace component' }).first()).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('ruleflow:replace-component-request', {
        detail: { componentId: 'unsupportedPlatformWidget', adapterHint: 'platform.fakeUnsupported' },
      }),
    );
  });
  await expect(page.getByTestId('builder-replace-component-card')).toBeVisible();
});
