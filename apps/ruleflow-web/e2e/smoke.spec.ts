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

test('navigation + header actions', async ({ page }) => {
  await page.goto('/');
  await waitForClientReady(page);

  await page.getByRole('link', { name: 'Explore Console' }).click();
  await expect(page).toHaveURL(/\/console/);
  await waitForClientReady(page);
  await expect(page.getByText('Loading console data...')).toBeHidden({ timeout: 120_000 });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export GitOps' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('ruleflow-gitops');

  await page.getByRole('button', { name: 'New Config' }).click();
  await expect(page.getByText('New Config Package')).toBeVisible();

  await page.getByPlaceholder('Orders Bundle').fill('QA Package');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/\/builder\?versionId=/);
  await expect(page.getByText('Schema Builder')).toBeVisible();
});

test('console lifecycle + diff + gitops import', async ({ page, request }, testInfo) => {
  const create = await request.post('/api/config-packages', {
    data: { name: 'QA E2E Package', description: 'created by Playwright' },
  });
  expect(create.ok()).toBeTruthy();
  const created = (await create.json()) as { ok: true; versionId: string };
  const versionId = created.versionId;

  await page.goto('/console?tab=versions');
  await waitForClientReady(page);
  await expect(page.getByText('Loading console data...')).toBeHidden({ timeout: 120_000 });
  const versionRow = page.getByTestId(`version-row-${versionId}`);

  await versionRow.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Submit For Review')).toBeVisible();
  const submitDialog = page.getByRole('dialog');
  await submitDialog.getByRole('button', { name: 'Submit' }).click();
  await expect(versionRow.getByText('REVIEW')).toBeVisible();

  await page.goto('/console?tab=governance');
  // Find the approval created for the submitted version by matching package name.
  const approvalRow = page.locator('[data-testid^="approval-row-"]').filter({ hasText: 'QA E2E Package' }).first();
  await approvalRow.getByRole('button', { name: 'Approve' }).click();
  // Wait for the approval mutation to commit before navigating away (page.goto triggers full navigation).
  await expect(approvalRow).toBeHidden({ timeout: 30_000 });

  await page.goto('/console?tab=versions');
  await expect(versionRow.getByText('APPROVED')).toBeVisible({ timeout: 30_000 });

  await versionRow.getByRole('button', { name: 'Promote' }).click();
  await expect(versionRow.getByText('ACTIVE')).toBeVisible({ timeout: 30_000 });

  await versionRow.getByRole('button', { name: 'Diff' }).click();
  await expect(page.getByText('Bundle Diff')).toBeVisible();
  const diffDialog = page.getByRole('dialog');
  await diffDialog
    .getByRole('button', { name: 'Close', exact: true })
    .filter({ hasText: 'Close' })
    .click();

  const exportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const bundleDownload = await exportDownload;
  const bundlePath = testInfo.outputPath('gitops-bundle.json');
  await bundleDownload.saveAs(bundlePath);

  await page.getByRole('button', { name: 'Import' }).click();
  await page.locator('input[type="file"]').setInputFiles(bundlePath);

  // Ensure the import didn't break the page.
  await expect(page.getByText('GitOps Package')).toBeVisible();
});

test('playground executes flow and shows trace', async ({ page }) => {
  await page.goto('/playground');
  await waitForClientReady(page);

  await expect(page.getByText('State:')).toBeVisible();

  const next = page.getByRole('button', { name: 'Next', exact: true });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByText('State: details')).toBeVisible();

  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByText('State: review')).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('State: submitted')).toBeVisible();

  await expect(page.getByText('POST https://api.example.com/orders')).toBeVisible();

  // Explain mode: per-rule clause results + reads + diffs.
  await page.getByLabel('Explain').check();
  const ruleDetails = page.getByTestId('rule-explain-US_ADMIN_DISCOUNT');
  const ruleSummary = ruleDetails.locator('summary');
  await expect(ruleSummary).toBeVisible();
  await ruleSummary.click();
  await expect(ruleDetails.getByText('COMPARE', { exact: true })).toBeVisible();
  await expect(ruleDetails.getByText('data.orderTotal=1200', { exact: true })).toBeVisible();
  await expect(ruleDetails.getByText('setField data.discount', { exact: true })).toBeVisible();
});

test('builder adds component and saves', async ({ page, request }) => {
  const create = await request.post('/api/config-packages', { data: { name: 'QA Builder Package' } });
  const created = (await create.json()) as { ok: true; versionId: string };

  await page.goto(`/builder?versionId=${encodeURIComponent(created.versionId)}`);
  await waitForClientReady(page);
  await expect(page.getByText('Schema Builder')).toBeVisible();
  await expect(page.locator('[data-testid^=\"canvas-item-\"]').first()).toBeVisible();

  await page.getByPlaceholder('Component id').fill('newField');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('heading', { name: 'newField' })).toBeVisible();

  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Saved UI schema')).toBeVisible();
});

test('builder drag-drops palette component onto canvas', async ({ page, request }, testInfo) => {
  const create = await request.post('/api/config-packages', { data: { name: 'QA DragDrop Package' } });
  const created = (await create.json()) as { ok: true; versionId: string };

  await page.goto(`/builder?versionId=${encodeURIComponent(created.versionId)}`);
  await waitForClientReady(page);
  await expect(page.getByText('Schema Builder')).toBeVisible();
  // Wait for initial persisted schema to load (builder disables drag-drop while loading).
  await expect(page.locator('[data-testid^=\"canvas-item-\"]').first()).toBeVisible();

  const paletteItem = page.getByTestId('palette-item-material-input');
  const canvas = page.getByTestId('builder-canvas');

  await expect(paletteItem).toBeEnabled();

  await paletteItem.scrollIntoViewIfNeeded();
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);

  const paletteBox = await paletteItem.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!paletteBox || !canvasBox) throw new Error('Missing bounding box for drag-drop test');

  // Playwright's `dragTo` uses HTML5 drag events; dnd-kit listens to pointer/mouse events.
  await page.mouse.move(paletteBox.x + paletteBox.width / 2, paletteBox.y + paletteBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + Math.min(80, canvasBox.height / 2), { steps: 15 });
  await page.mouse.up();

  await expect(page.getByTestId('canvas-item-input')).toBeVisible({ timeout: 30_000 });

  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Saved UI schema')).toBeVisible();
});

test('visual snapshots (no assertion)', async ({ page }, testInfo) => {
  const breakpoints = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'laptop', width: 1024, height: 800 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 375, height: 812 },
  ];

  const routes = ['/', '/console', '/builder', '/playground', '/docs'];

  for (const bp of breakpoints) {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(250);
      const safe = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '');
      const out = testInfo.outputPath(`visual-${bp.name}-${safe}.png`);
      await page.screenshot({ path: out, fullPage: true });
    }
  }
});

test('getting started wizard completes core walkthrough', async ({ page }) => {
  await page.goto('/');
  await waitForClientReady(page);

  await page.getByRole('button', { name: 'Get Started' }).click();
  const wizard = page.getByRole('dialog');
  await expect(wizard.getByText('Getting Started')).toBeVisible();

  // Step 1: clone a sample config.
  await wizard.getByRole('button', { name: 'Clone sample' }).first().click();
  await expect(page).toHaveURL(/\/builder\?versionId=/);
  await waitForClientReady(page);

  const versionId = new URL(page.url()).searchParams.get('versionId');
  if (!versionId) throw new Error('Missing versionId after cloning sample');

  // Step 2 + 5: save (blocked if validation fails).
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved UI schema')).toBeVisible();

  // Step 3: add a rule and save.
  await page.goto(`/builder/rules?versionId=${encodeURIComponent(versionId)}`);
  await waitForClientReady(page);
  await page.getByRole('button', { name: 'Add starter rule' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved rule set')).toBeVisible();

  // Step 6 + 7: run submit, then inspect explain trace.
  await page.goto(`/playground?versionId=${encodeURIComponent(versionId)}&autorun=submit&focus=trace&explain=1`);
  await waitForClientReady(page);
  await expect(page.getByText('State: submitted')).toBeVisible();
  await page.getByLabel('Explain').check();
  const ruleDetails = page.getByTestId('rule-explain-US_ADMIN_DISCOUNT');
  await ruleDetails.locator('summary').click();
  await expect(ruleDetails.getByText('COMPARE', { exact: true })).toBeVisible();
  await expect(ruleDetails.getByText('setField data.discount', { exact: true })).toBeVisible();
});
