import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const open = async (page: import('@playwright/test').Page, slug: string) => {
  await page.goto(`/tools/${slug}`);
  await expect(page.locator('.workspace .tool-loading')).toHaveCount(0, { timeout: 10_000 });
};

test('home shows only real tools and honest counts', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.tool-card');
  await expect(cards.first()).toBeVisible();
  await expect(page.getByText(/200\+/)).toHaveCount(0);
});

test('Ctrl/⌘+K search: keyboard navigation, Enter opens tool, Escape restores focus', async ({ page }) => {
  await page.goto('/');
  await page.locator('h1').click();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('dialog.search-dialog[open]')).toBeVisible();
  await page.keyboard.type('kg to lbs');
  await expect(page.locator('.search-results li.is-active .sr-name')).toHaveText(/Mass Converter/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/tools\/mass-converter$/);
  await page.locator('.search-trigger').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.search-dialog[open]')).toHaveCount(0);
  await expect(page.locator('.search-trigger')).toBeFocused();
});

test('Ctrl+K does not hijack typing inside a text box', async ({ page }) => {
  await open(page, 'case-converter');
  await page.getByLabel('Input').focus();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('dialog.search-dialog[open]')).toHaveCount(0);
});

test('tools page filters live in the URL and survive back/forward', async ({ page }) => {
  await page.goto('/tools');
  await page.getByRole('link', { name: /^Text \d+/ }).first().click();
  await expect(page).toHaveURL(/category=text/);
  await page.getByLabel('Filter tools').fill('json');
  await expect(page).toHaveURL(/q=json/);
  await page.goBack();
  await expect(page).toHaveURL(/\/tools$|category=text$/);
});

test('planned tools are not routable', async ({ page }) => {
  const res = await page.goto('/tools/pdf-merge');
  expect(res?.status()).toBe(404);
});

test('PNG → JPEG produces real JPEG bytes', async ({ page }) => {
  await open(page, 'png-to-jpeg');
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 40;
    c.getContext('2d')!.fillRect(0, 0, 32, 40);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.getByRole('button', { name: 'Convert to JPEG' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download JPG/ }).click()]);
  expect(dl.suggestedFilename()).toBe('test.jpg');
  expect([...readFileSync((await dl.path())!).subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
});

test('regex tester stops catastrophic backtracking', async ({ page }) => {
  await open(page, 'regex-tester');
  await page.getByLabel('Test text').fill('a'.repeat(40) + '!');
  await page.getByLabel('Pattern (without slashes)').fill('^(a+)+$');
  await expect(page.getByText(/Stopped after 1.5 s/)).toBeVisible({ timeout: 6000 });
});

test('markdown preview never executes HTML', async ({ page }) => {
  await open(page, 'markdown-preview');
  await page.getByLabel('Markdown').fill('<img src=x onerror="window.__p=1"><script>window.__p=2</script>');
  await expect(page.locator('.md-preview')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __p?: number }).__p ?? null)).toBeNull();
});

for (const slug of ['word-counter', 'json-formatter', 'csv-viewer', 'image-compress', 'basic-calculator', 'text-diff']) {
  test(`@mobile no horizontal overflow: ${slug}`, async ({ page }) => {
    await open(page, slug);
    const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
    expect(sw).toBeLessThanOrEqual(w);
  });
}
