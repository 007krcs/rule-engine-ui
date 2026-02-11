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

test('config lifecycle: submit, approve, publish(promote), export', async ({ page, request }) => {
  const create = await request.post('/api/config-packages', {
    data: { name: 'QA Console Lifecycle Package', description: 'lifecycle e2e' },
  });
  expect(create.ok()).toBeTruthy();
  const created = (await create.json()) as { ok: true; versionId: string };
  const versionId = created.versionId;

  await page.goto('/console?tab=versions');
  await waitForClientReady(page);
  await expect(page.getByText('Loading console data...')).toBeHidden({ timeout: 120_000 });

  const versionRow = page.getByTestId(`version-row-${versionId}`);
  await expect(versionRow).toBeVisible();

  await versionRow.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Submit For Review')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await expect(versionRow.getByText('REVIEW')).toBeVisible({ timeout: 30_000 });

  await page.goto('/console?tab=governance');
  await waitForClientReady(page);
  const approvalRow = page.locator('[data-testid^="approval-row-"]').filter({ hasText: 'QA Console Lifecycle Package' }).first();
  await expect(approvalRow).toBeVisible({ timeout: 30_000 });
  await approvalRow.getByRole('button', { name: 'Approve' }).click();
  await expect(approvalRow).toBeHidden({ timeout: 30_000 });

  await page.goto('/console?tab=versions');
  await waitForClientReady(page);
  await expect(versionRow.getByText('APPROVED')).toBeVisible({ timeout: 30_000 });

  // "Publish" in this UI is the "Promote" action.
  await versionRow.getByRole('button', { name: 'Promote' }).click();
  await expect(versionRow.getByText('ACTIVE')).toBeVisible({ timeout: 30_000 });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('ruleflow-gitops');
});
