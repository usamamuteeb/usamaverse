import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const clip = join(__dirname, '..', 'tests', 'fixtures', 'media', 'clip.mp4');

test('video trimmer re-encodes a real half-second MP4 locally', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/tools/video-trim');
  await page.locator('input[type=file]').setInputFiles(clip);
  await page.getByLabel('End (seconds)').fill('0.5');
  await page.getByRole('button', { name: 'Trim video' }).click();
  const button = page.getByRole('button', { name: 'Download MP4' });
  await expect(button).toBeVisible({ timeout: 150_000 });
  const promise = page.waitForEvent('download');
  await button.click();
  const bytes = readFileSync((await (await promise).path())!);
  expect(bytes.toString('ascii', 4, 8)).toBe('ftyp');
});

test('mute video removes audio and exports MP4 locally', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/tools/video-mute');
  await page.locator('input[type=file]').setInputFiles(clip);
  await page.getByRole('button', { name: 'Remove audio' }).click();
  const button = page.getByRole('button', { name: 'Download MP4' });
  await expect(button).toBeVisible({ timeout: 150_000 });
  const promise = page.waitForEvent('download');
  await button.click();
  const bytes = readFileSync((await (await promise).path())!);
  expect(bytes.toString('ascii', 4, 8)).toBe('ftyp');
  await page.goto('/tools/video-inspector');
  await page.locator('input[type=file]').setInputFiles({ name: 'muted.mp4', mimeType: 'video/mp4', buffer: bytes });
  await expect(page.locator('table caption').filter({ hasText: /^Audio track/ })).toHaveCount(0);
});

test('media converter extracts MP3 from a real MP4 locally', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/tools/media-convert');
  await page.locator('input[type=file]').setInputFiles(clip);
  await page.getByLabel('Output format').selectOption('mp3');
  await page.getByRole('button', { name: 'Convert media' }).click();
  const button = page.getByRole('button', { name: 'Download MP3' });
  await expect(button).toBeVisible({ timeout: 150_000 });
  const promise = page.waitForEvent('download');
  await button.click();
  const bytes = readFileSync((await (await promise).path())!);
  expect(bytes.length).toBeGreaterThan(100);
  expect(bytes.subarray(0, 3).toString('ascii')).toBe('ID3');
});
