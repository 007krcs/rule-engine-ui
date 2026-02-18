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

test('runtime flags toggle external palette and kill switch disables promote', async ({ page, request }) => {
  const create = await request.post('/api/config-packages', {
    data: { name: 'Runtime Controls E2E Package' },
  });
  expect(create.ok()).toBeTruthy();
  const created = (await create.json()) as { ok: true; versionId: string };
  const versionId = created.versionId;

  const disableExternal = await request.post('/api/feature-flags', {
    data: { env: 'prod', key: 'builder.palette.externalAdapters', enabled: false },
  });
  if (!disableExternal.ok()) {
    test.skip(true, 'Feature flags persistence requires Postgres provider');
  }

  await page.goto(`/builder?versionId=${encodeURIComponent(versionId)}`);
  await waitForClientReady(page);
  await expect(page.getByTestId('palette-item-material-input')).toHaveCount(0);
  await expect(page.getByTestId('builder-external-palette-disabled')).toBeVisible();

  const enableExternal = await request.post('/api/feature-flags', {
    data: { env: 'prod', key: 'builder.palette.externalAdapters', enabled: true },
  });
  expect(enableExternal.ok()).toBeTruthy();

  await page.reload();
  await waitForClientReady(page);
  await expect(page.getByTestId('palette-item-material-input')).toBeVisible();

  const submit = await request.post(`/api/config-versions/${encodeURIComponent(versionId)}/submit-review`, {
    data: { scope: 'Tenant: Runtime E2E', risk: 'Medium' },
  });
  expect(submit.ok()).toBeTruthy();

  const snapshotResp = await request.get('/api/console');
  expect(snapshotResp.ok()).toBeTruthy();
  const snapshot = (await snapshotResp.json()) as {
    approvals: Array<{ id: string; versionId: string }>;
  };
  const approval = snapshot.approvals.find((item) => item.versionId === versionId);
  expect(approval).toBeTruthy();

  const approve = await request.post(`/api/approvals/${encodeURIComponent(approval!.id)}/approve`);
  expect(approve.ok()).toBeTruthy();

  const kill = await request.post('/api/kill-switches', {
    data: { scope: 'VERSION', active: true, versionId, reason: 'Emergency runtime stop' },
  });
  expect(kill.ok()).toBeTruthy();

  await page.goto('/console?tab=versions');
  await waitForClientReady(page);
  const row = page.getByTestId(`version-row-${versionId}`);
  await expect(row).toBeVisible();
  const promoteButton = row.getByRole('button', { name: 'Promote' });
  await expect(promoteButton).toBeDisabled();

  const promote = await request.post(`/api/config-versions/${encodeURIComponent(versionId)}/promote`);
  expect(promote.status()).toBe(409);
});
