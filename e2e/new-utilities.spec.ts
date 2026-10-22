import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

test('emoji search filters locally and selects a character', async ({ page }) => {
  await page.goto('/tools/emoji-search');
  await page.getByLabel('Search by name or keyword').fill('fox');
  await expect(page.getByRole('button', { name: 'Fox' })).toBeVisible();
  await page.getByRole('button', { name: 'Fox' }).click();
  await expect(page.getByText(/Selected:.*Fox/)).toBeVisible();
});

test('label maker calculates a printable sheet', async ({ page }) => {
  await page.goto('/tools/label-printer');
  await page.getByLabel('Label text — one label per line').fill('A\nB');
  await page.getByLabel('Copies of each line').fill('3');
  await expect(page.getByText('6 labels on 1 page.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeEnabled();
});

test('screen ruler measures after calibration', async ({ page }) => {
  await page.goto('/tools/screen-ruler');
  await page.getByLabel(/Calibration bar width/).focus();
  await page.keyboard.press('ArrowRight');
  await page.locator('.screen-ruler').click({ position: { x: 80, y: 35 } });
  await page.locator('.screen-ruler').click({ position: { x: 180, y: 35 } });
  await expect(page.getByText(/Distance:.*100\.0 screen px.*26\.3 mm/)).toBeVisible();
});

test('PDF workflow downloads the result of a saved recipe', async ({ page }) => {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]);
  const source = Buffer.from(await doc.save());
  await page.goto('/tools/pdf-workflow');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'source.pdf', mimeType: 'application/pdf', buffer: source });
  await page.getByRole('button', { name: 'Save recipe here' }).click();
  await expect(page.getByText('Recipe saved on this device.')).toBeVisible();
  await page.getByRole('button', { name: 'Run recipe on PDF' }).click();
  const button = page.getByRole('button', { name: /Download PDF/ });
  await expect(button).toBeVisible({ timeout: 20_000 });
  const promise = page.waitForEvent('download');
  await button.click();
  const bytes = readFileSync((await (await promise).path())!);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
});

test('ZIP creator and extractor round-trip a local file', async ({ page }) => {
  await page.goto('/tools/zip-create');
  await page.locator('input[type=file]').setInputFiles({ name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('ZIP round trip') });
  await page.getByRole('button', { name: 'Create ZIP' }).click();
  const zipPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ZIP' }).click();
  const archive = readFileSync((await (await zipPromise).path())!);
  await page.goto('/tools/zip-extract');
  await page.locator('input[type=file]').setInputFiles({ name: 'archive.zip', mimeType: 'application/zip', buffer: archive });
  await expect(page.getByText('hello.txt')).toBeVisible();
  const filePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect(readFileSync((await (await filePromise).path())!).toString()).toBe('ZIP round trip');
});

test('passphrase generator uses six local random words', async ({ page }) => {
  await page.goto('/tools/passphrase-generator');
  const output = page.getByRole('textbox', { name: 'Passphrases' });
  await expect(output).not.toHaveValue('');
  const first = await output.inputValue();
  expect(first.split('-')).toHaveLength(6);
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(output).not.toHaveValue(first);
});
