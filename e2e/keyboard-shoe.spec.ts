import { expect, test } from '@playwright/test';

test('keyboard layout helper previews physical remapping', async ({ page }) => {
  await page.goto('/tools/keyboard-layout-helper');
  await page.getByLabel('Sample text').fill('Qy');
  await page.getByLabel('Same keys on').selectOption('qwertz');
  await expect(page.getByRole('textbox', { name: 'What the same keys would type' })).toHaveValue('Qz');
});

test('shoe conversion uses a published chart and sizes up a foot measurement', async ({ page }) => {
  await page.goto('/tools/shoe-size-converter');
  await page.getByLabel('Length of your longer foot').fill('26.4');
  await expect(page.locator('.shoe-results')).toContainText('26.7 cm');
  await expect(page.locator('.shoe-results')).toContainText('US men');
});
