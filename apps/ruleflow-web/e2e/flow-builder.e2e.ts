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

test('builds a two-state flow and playground submit moves to next state', async ({ page, request }) => {
  const create = await request.post('/api/config-packages', {
    data: { name: 'Flow Builder E2E Package' },
  });
  expect(create.ok()).toBeTruthy();
  const created = (await create.json()) as { ok: true; versionId: string };

  await page.goto(`/builder/flow?versionId=${encodeURIComponent(created.versionId)}`);
  await waitForClientReady(page);

  await page.getByTestId('flow-state-id-input').fill('review');
  await page.getByTestId('flow-add-state-button').click();
  await expect(page.getByTestId('flow-node-review')).toBeVisible();

  await page.getByTestId('flow-node-start').click();
  await page.getByTestId('flow-add-transition-button').click();

  const transitionTargets = page.locator('[data-testid^="flow-transition-target-start-"]');
  const transitionCount = await transitionTargets.count();
  expect(transitionCount).toBeGreaterThan(0);
  const targetSelect = transitionTargets.nth(transitionCount - 1);
  await targetSelect.selectOption('review');

  const transitionEvents = page.locator('[data-testid^="flow-transition-event-start-"]');
  const eventInput = transitionEvents.nth(transitionCount - 1);
  await eventInput.fill('submit');
  await eventInput.blur();

  await expect(page.getByTestId('flow-save-button')).toBeEnabled();
  await page.getByTestId('flow-save-button').click();
  await expect(page.getByTestId('flow-save-button')).toContainText('Save Flow');

  await page.goto(`/playground?versionId=${encodeURIComponent(created.versionId)}`);
  await waitForClientReady(page);

  const stateRow = page.getByTestId('playground-current-state');
  await expect(stateRow).toContainText('start');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(stateRow).toContainText('review');
});
