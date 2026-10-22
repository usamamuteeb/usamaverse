import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const open = async (page: import('@playwright/test').Page, slug: string) => {
  await page.goto(`/tools/${slug}`);
  await expect(page.locator('.workspace .tool-loading')).toHaveCount(0, { timeout: 10_000 });
};

test('home leads to workspaces without repeating the full directory', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /make the small tasks/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /browse workspaces/i })).toHaveAttribute('href', '/tools');
  await expect(page.getByRole('link', { name: /work with pdfs/i })).toHaveAttribute('href', '/category/pdf');
  await expect(page.locator('.directory, .dir-cat')).toHaveCount(0);
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

test('unknown tools are not routable', async ({ page }) => {
  const res = await page.goto('/tools/not-a-real-tool');
  expect(res?.status()).toBe(404);
});

test('workspaces switch between related actions and keep direct tool URLs', async ({ page }) => {
  await page.goto('/workspaces/pdf-editor');
  await expect(page.getByRole('heading', { level: 1, name: 'Edit PDF' })).toBeVisible();
  // Wide screens list the category's actions in the side panel; narrow screens show chips.
  const nav = page.getByRole('navigation', { name: 'PDF tools' });
  const switcher = page.getByRole('navigation', { name: 'PDF editor actions' });
  await ((await nav.isVisible()) ? nav : switcher).getByRole('link', { name: 'Sign PDF' }).click();
  await expect(page).toHaveURL(/\/workspaces\/pdf-editor\?tool=sign-pdf/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign PDF' })).toBeVisible();
  await page.getByRole('link', { name: 'Direct link' }).click();
  await expect(page).toHaveURL(/\/tools\/sign-pdf$/);
});

test('PDF editor changes existing text while preserving the PDF and form fields', async ({ page }) => {
  const doc = await PDFDocument.create();
  const sheet = doc.addPage([400, 400]);
  sheet.drawText('Original', { x: 60, y: 320, size: 20, font: await doc.embedFont(StandardFonts.Helvetica), color: rgb(0, 0, 0) });
  sheet.drawText('Untouched', { x: 60, y: 280, size: 20, font: await doc.embedFont(StandardFonts.Helvetica) });
  const field = doc.getForm().createTextField('reference');
  field.setText('AB-123');
  field.addToPage(sheet, { x: 60, y: 200, width: 110, height: 24 });
  const source = Buffer.from(await doc.save());
  await page.goto('/workspaces/pdf-editor');
  await page.locator('input[type=file]').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: source });
  await expect(page.locator('.page-view svg')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('combobox', { name: 'Tool' }).selectOption('replace');
  const box = await page.locator('.page-view svg').boundingBox();
  expect(box).not.toBeNull();
  await page.locator('.page-view svg').click({ position: { x: box!.width * 0.21, y: box!.height * 0.19 } });
  await page.getByRole('textbox', { name: 'Replacement text' }).fill('Updated');
  await page.getByRole('button', { name: 'Apply replacement' }).click();
  await page.getByRole('button', { name: /Save edited PDF/ }).click();
  const downloadButton = page.getByRole('button', { name: /Download PDF/ });
  await expect(downloadButton).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
  const result = readFileSync((await download.path())!);
  const reopened = await PDFDocument.load(result);
  expect(reopened.getForm().getTextField('reference').getText()).toBe('AB-123');
  await page.goto('/tools/pdf-to-text');
  await page.locator('input[type=file]').setInputFiles({ name: 'result.pdf', mimeType: 'application/pdf', buffer: result });
  await page.getByRole('button', { name: 'Extract text' }).click();
  await expect(page.getByRole('textbox', { name: 'Markdown' })).toHaveValue(/Updated/);
  const extracted = await page.getByRole('textbox', { name: 'Markdown' }).inputValue();
  expect(extracted).toContain('Updated');
  expect(extracted).toContain('Untouched');
  expect(extracted).not.toContain('Original');
});

test('OCR PDF adds searchable text to a scanned page locally', async ({ page }) => {
  test.slow();
  await page.goto('/tools/ocr-pdf');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 350;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000'; ctx.font = 'bold 72px Arial';
    ctx.fillText('SCANNED DOCUMENT', 40, 150);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const doc = await PDFDocument.create();
  const sheet = doc.addPage([500, 175]);
  const image = await doc.embedPng(Buffer.from(png, 'base64'));
  sheet.drawImage(image, { x: 0, y: 0, width: 500, height: 175 });
  await page.locator('input[type=file]').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) });
  await page.getByRole('button', { name: 'Make PDF searchable' }).click();
  await expect(page.getByText(/Added \d+ recognized words/)).toBeVisible({ timeout: 90_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download searchable PDF/ }).click()]);
  const result = readFileSync((await download.path())!);
  await page.goto('/tools/pdf-to-text');
  await page.locator('input[type=file]').setInputFiles({ name: 'searchable.pdf', mimeType: 'application/pdf', buffer: result });
  await page.getByRole('button', { name: 'Extract text' }).click();
  await expect(page.getByRole('textbox', { name: 'Markdown' })).toHaveValue(/SCANNED DOCUMENT/);
});

test('Extract PDF Images downloads an embedded image at native size', async ({ page }) => {
  await page.goto('/tools/pdf-image-extract');
  const doc = await PDFDocument.create();
  const sheet = doc.addPage([300, 300]);
  const redPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
  const image = await doc.embedPng(redPixel);
  sheet.drawImage(image, { x: 20, y: 20, width: 100, height: 100 });
  await page.locator('input[type=file]').setInputFiles({ name: 'image.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) });
  await page.getByRole('button', { name: 'Extract embedded images' }).click();
  await expect(page.getByText('Page 1 · 1 × 1 px')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download PNG/ }).click()]);
  const result = readFileSync((await download.path())!);
  expect(result.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
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
  await page.getByRole('textbox', { name: 'Markdown' }).fill('<img src=x onerror="window.__p=1"><script>window.__p=2</script>');
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

test('@mobile PDF workspace fits viewport', async ({ page }) => {
  await page.goto('/workspaces/pdf-editor');
  const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(sw).toBeLessThanOrEqual(w);
});

test('Resume Tailor tailors the sample resume and keeps a history entry', async ({ page }) => {
  await page.goto('/apps/resume-tailor');
  await page.getByRole('button', { name: 'Example job' }).click();
  await page.getByRole('button', { name: 'Tailor my resume' }).click();
  await expect(page.locator('.rt-score')).toBeVisible();
  const after = Number((await page.locator('.rt-after').innerText()).replace('%', ''));
  const before = Number((await page.locator('.rt-score-num').first().innerText()).replace('%', ''));
  expect(after).toBeGreaterThan(before);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download .tex' }).click()]);
  const tex = readFileSync((await download.path())!, 'utf8');
  expect(tex).toContain('\\begin{document}');
  await page.getByRole('tab', { name: /History/ }).click();
  await expect(page.locator('.rt-history tbody tr')).toHaveCount(1);
});

test('CV Builder downloads a PDF and a Word file of the example CV', async ({ page }) => {
  await page.goto('/workspaces/cv-studio?tool=cv-builder');
  await page.getByRole('button', { name: 'Load example' }).click();
  for (const name of ['Download PDF', 'Word (.docx)']) {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()]);
    const bytes = readFileSync((await download.path())!);
    expect(bytes.length).toBeGreaterThan(2000);
  }
});
