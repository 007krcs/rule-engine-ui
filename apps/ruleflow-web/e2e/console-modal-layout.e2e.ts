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

test('getting started modal stays usable at 1366x768 with owned body scroll', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/console');
  await waitForClientReady(page);
  await expect(page.getByText('Loading console data...')).toBeHidden({ timeout: 120_000 });

  await page.locator('main').evaluate((node) => {
    node.scrollTop = 420;
  });
  const mainScrollBeforeModal = await page.locator('main').evaluate((node) => node.scrollTop);

  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
  const dialog = page.getByTestId('modal-dialog');
  const dialogBody = page.getByTestId('modal-body');
  const footerClose = page.getByTestId('modal-footer').getByRole('button', { name: 'Close', exact: true });

  await expect(dialog).toBeVisible();
  await expect(footerClose).toBeVisible();

  const dialogCanScroll = await dialogBody.evaluate((node) => node.scrollHeight > node.clientHeight);
  expect(dialogCanScroll).toBeTruthy();

  await dialogBody.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  const dialogScrollAfterJump = await dialogBody.evaluate((node) => node.scrollTop);
  expect(dialogScrollAfterJump).toBeGreaterThan(0);

  await expect(dialogBody.getByTestId('onboarding-step-gitops')).toBeVisible();
  await expect(footerClose).toBeVisible();

  await page.mouse.move(4, 4);
  await page.mouse.wheel(0, 720);
  const mainScrollWhileModalOpen = await page.locator('main').evaluate((node) => node.scrollTop);
  expect(mainScrollWhileModalOpen).toBe(mainScrollBeforeModal);

  await page.screenshot({
    path: testInfo.outputPath('console-getting-started-modal.png'),
    fullPage: false,
  });
});
