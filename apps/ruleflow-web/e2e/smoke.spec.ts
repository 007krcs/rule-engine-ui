import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('/api/system/reset');
});

test('navigation + header actions', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Explore Console' }).click();
  await expect(page).toHaveURL(/\/console/);

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
});

test('builder adds component and saves', async ({ page, request }) => {
  const create = await request.post('/api/config-packages', { data: { name: 'QA Builder Package' } });
  const created = (await create.json()) as { ok: true; versionId: string };

  await page.goto(`/builder?versionId=${encodeURIComponent(created.versionId)}`);
  await expect(page.getByText('Schema Builder')).toBeVisible();

  await page.getByPlaceholder('Component id').fill('newField');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('heading', { name: 'newField' })).toBeVisible();

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
