import { test, expect } from '@playwright/test';

test('builder redirects to screens and shows new shell banner', async ({ page }) => {
  await page.goto('/builder?versionId=abc123');
  await expect(page).toHaveURL(/\/builder\/screens.*versionId=abc123/);
  await expect(page.getByText('NEW BUILDER SHELL ✅')).toBeVisible();
});

test('legacy builder is reachable', async ({ page }) => {
  await page.goto('/builder/legacy');
  await expect(page.getByText(/Ruleflow Builder/i)).toBeVisible();
});
