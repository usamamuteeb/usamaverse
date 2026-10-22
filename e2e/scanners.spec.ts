import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('generated QR PNG is decoded by the local QR reader', async ({ page }) => {
  await page.goto('/tools/qr-generator');
  await page.getByRole('textbox', { name: 'Text or URL' }).fill('usamaverse-scan-test');
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG' }).click();
  const bytes = readFileSync((await (await promise).path())!);
  await page.goto('/tools/qr-reader');
  await page.locator('input[type=file]').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.getByRole('textbox', { name: 'Decoded content' })).toHaveValue('usamaverse-scan-test', { timeout: 15_000 });
});

test('generated barcode PNG is decoded by the local barcode reader', async ({ page }) => {
  await page.goto('/tools/barcode-generator');
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG' }).click();
  const bytes = readFileSync((await (await promise).path())!);
  await page.goto('/tools/barcode-reader');
  await page.locator('input[type=file]').setInputFiles({ name: 'barcode.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.getByRole('textbox', { name: 'Decoded content' })).toHaveValue('USAMA-2026', { timeout: 15_000 });
});
