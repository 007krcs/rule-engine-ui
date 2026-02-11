import { expect, test } from '@playwright/test';
import path from 'path';

const outDir = path.resolve(process.cwd(), 'apps/ruleflow-web/public/docs');

async function snap(page: import('@playwright/test').Page, name: string) {
  const filePath = path.join(outDir, name);
  await page.screenshot({ path: filePath, fullPage: true });
}

test.beforeEach(async ({ page }) => {
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

test('capture docs screenshots', async ({ page, request }) => {
  const create = await request.post('/api/config-packages', { data: { name: 'Docs Screenshots' } });
  expect(create.ok()).toBeTruthy();
  const created = (await create.json()) as { ok: true; versionId: string };
  const versionId = created.versionId;

  await page.setViewportSize({ width: 1280, height: 800 });

  await page.route(/\/api\/config-versions\/.+\/diff/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        before: { id: 'ver-2026.01.30', version: '2026.01.30' },
        after: { id: 'ver-2026.02.07-rc1', version: '2026.02.07-rc1' },
        diffs: [
          { path: 'uiSchema.version', before: '1.0.0', after: '1.0.1' },
          { path: 'flowSchema.version', before: '1.0.0', after: '1.0.1' },
        ],
      }),
    });
  });

  await page.goto(`/console?tab=versions`);
  await expect(page.getByText('Loading console data...')).toBeHidden({ timeout: 120_000 });
  await snap(page, 'console-versions.png');

  const diffRow = page
    .locator('[data-testid^="version-row-"]')
    .filter({ hasNot: page.getByText('Docs Screenshots') })
    .first();
  const diffTestId = await diffRow.getAttribute('data-testid');
  const diffVersionId = diffTestId?.replace('version-row-', '') || versionId;
  await diffRow.getByRole('button', { name: 'Diff' }).click();
  await expect(page.getByText('Bundle Diff')).toBeVisible({ timeout: 60_000 });
  await snap(page, 'console-bundle-diff.png');
  await page.getByRole('button', { name: 'Close', exact: true }).first().click();

  await page.goto(`/builder?versionId=${encodeURIComponent(versionId)}`);
  await expect(page.getByText('Schema Builder')).toBeVisible();
  await expect(page.locator('[data-testid^="canvas-item-"]').first()).toBeVisible();
  await snap(page, 'builder-palette-canvas.png');

  const firstCanvas = page.locator('[data-testid^="canvas-item-"]').first();
  await firstCanvas.click();
  await expect(page.getByText('Properties')).toBeVisible();
  await snap(page, 'builder-props-panel.png');

  await page.goto(`/builder?versionId=${encodeURIComponent(versionId)}&preview=1`);
  await expect(page.getByText('Preview Mode')).toBeVisible();
  await snap(page, 'builder-preview-breakpoints.png');

  await page.goto(`/builder/rules?versionId=${encodeURIComponent(versionId)}`);
  await expect(page.getByText('Rules Builder')).toBeVisible();
  await snap(page, 'rules-builder.png');

  await page.goto(`/playground?versionId=${encodeURIComponent(diffVersionId)}&focus=trace&explain=1`);
  await expect(page.getByText('Context Simulator')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText('State: submitted')).toBeVisible({ timeout: 120_000 });
  await snap(page, 'playground-context.png');
  await snap(page, 'playground-trace.png');

  await page.goto('/component-registry');
  await expect(page.getByRole('heading', { name: 'Component Registry', level: 1 })).toBeVisible();
  await snap(page, 'component-registry.png');

  await page.goto('/integrations');
  await expect(page.getByRole('heading', { name: 'Integration Hub', level: 1 })).toBeVisible();
  await snap(page, 'integration-hub.png');

  await page.goto('/docs/tutorial-theming');
  await expect(page.getByRole('heading', { name: 'Tutorial: Theming + CSS Variable Overrides' })).toBeVisible();
  await snap(page, 'theming-css-vars.png');

  await page.goto('/docs/tutorial-company-adapter');
  await expect(page.getByRole('heading', { name: 'Tutorial: Add Your Company Component In 10 Minutes' })).toBeVisible();
  await snap(page, 'company-adapter-palette.png');
  await snap(page, 'company-adapter-props.png');
});
