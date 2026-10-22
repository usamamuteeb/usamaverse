import { expect, test } from '@playwright/test';

test('App tab opens the Apps collection and UsamaType', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'App' }).click();
  await expect(page).toHaveURL(/\/apps$/);
  await page.getByRole('link', { name: /UsamaType/ }).click();
  await expect(page).toHaveURL(/\/apps\/typing$/);
  await expect(page.getByRole('heading', { name: 'UsamaType' })).toBeVisible();
});

test('first printable input starts a word run; result and local history survive reload', async ({ page }) => {
  await page.goto('/apps/typing');
  await expect(page.locator('.typing-app')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: /Words/ }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  const target = (await page.locator('#typing-full-prompt').innerText()).replace(/^Practice text: /, '');
  const input = page.getByRole('textbox', { name: 'Typing input' });
  await input.focus();
  await page.keyboard.press('Shift');
  await expect(page.locator('.typing-state')).toContainText('Ready');
  await page.keyboard.type(target[0]);
  await expect(page.locator('.typing-state')).toContainText('Running');
  await page.waitForTimeout(1100);
  await page.keyboard.type(target.slice(1));
  await expect(page.getByRole('heading', { name: 'Your result' })).toBeVisible();
  await page.getByRole('tab', { name: 'Local history' }).click();
  await expect(page.locator('.typing-history tbody tr')).toHaveCount(1);
  await page.reload();
  await page.getByRole('tab', { name: 'Local history' }).click();
  await expect(page.locator('.typing-history tbody tr')).toHaveCount(1);
});

test('compact desktop layout keeps the passage and controls in view', async ({ page }) => {
  await page.setViewportSize({ width: 1708, height: 877 });
  await page.goto('/apps/typing');
  await expect(page.locator('.typing-app')).toHaveAttribute('data-ready', 'true');
  const bounds = await page.evaluate(() => ({
    passageTop: document.querySelector('.typing-passage')!.getBoundingClientRect().top,
    actionsBottom: document.querySelector('.typing-actions')!.getBoundingClientRect().bottom,
    scrollWidth: document.documentElement.scrollWidth,
    width: innerWidth,
  }));
  expect(bounds.passageTop).toBeLessThan(430);
  expect(bounds.actionsBottom).toBeLessThan(840);
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
  await page.locator('.typing-passage-wrap').click();
  await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeFocused();
  await page.keyboard.type('a');
  await expect(page.locator('.typing-state')).toContainText('Running');
});

test('custom setup accepts paste while active typing rejects it', async ({ page }) => {
  await page.goto('/apps/typing');
  await expect(page.locator('.typing-app')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: /Custom/ }).click();
  await page.locator('.typing-custom-label textarea').fill('Calm days make clear ideas.');
  await expect(page.locator('#typing-full-prompt')).toContainText('Calm days make clear ideas.');
  const input = page.getByRole('textbox', { name: 'Typing input' });
  await input.focus();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('Calm'));
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('.typing-state')).toContainText('Ready');
  await input.pressSequentially('C');
  await expect(page.locator('.typing-state')).toContainText('Running');
});

test('@mobile App and typing practice fit the viewport', async ({ page }) => {
  await page.goto('/apps/typing');
  await expect(page.locator('.typing-app')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('heading', { name: 'UsamaType' })).toBeVisible();
  const { width, scrollWidth } = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(width);
  await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeAttached();
});
