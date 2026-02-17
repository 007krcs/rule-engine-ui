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

  await page.getByTestId('palette-item-platform-chip').click();
  await page.getByTestId('builder-quick-add-id').fill('chipWidget');
  await page.getByTestId('builder-quick-add-button').click();
  await expect(page.getByText('Unsupported platform component: platform.chip')).toHaveCount(0);
  await expect(page.getByTestId('builder-grid-item-chipWidget')).toBeVisible();

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
  await expect(page.getByText('Component not available')).toBeVisible();
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
