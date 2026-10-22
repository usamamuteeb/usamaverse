import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixture = (name: string) => join(__dirname, '..', 'tests', 'fixtures', 'media', name);

test('audio inspector decodes a real WAV and renders levels', async ({ page }) => {
  await page.goto('/tools/audio-inspector');
  await page.locator('input[type="file"]').setInputFiles(fixture('tone.wav'));
  await expect(page.getByText('Average (RMS)')).toBeVisible();
  await expect(page.getByRole('img', { name: /Waveform of tone.wav/ })).toBeVisible();
  await expect(page.locator('audio.media-player')).toHaveAttribute('src', /^blob:/);
});

test('audio trimmer exports the selected real WAV samples', async ({ page }) => {
  await page.goto('/tools/audio-trim');
  await page.locator('input[type="file"]').setInputFiles(fixture('tone.wav'));
  await expect(page.getByRole('button', { name: /Download WAV/ })).toBeVisible();
  await page.getByRole('textbox', { name: 'Start' }).fill('0.10');
  await page.getByRole('textbox', { name: 'End' }).fill('0.30');
  await page.getByRole('button', { name: 'Apply times' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download WAV/ }).click();
  const bytes = readFileSync((await (await downloadPromise).path())!);
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.readUInt32LE(40)).toBe(3200); // 0.2 s × 8 kHz × 16-bit mono
});

test('audio joiner combines two decoded files', async ({ page }) => {
  await page.goto('/tools/media-join');
  await page.locator('input[type="file"]').setInputFiles([fixture('tone.wav'), fixture('tone.wav')]);
  await page.getByRole('button', { name: 'Join 2 clips' }).click();
  const button = page.getByRole('button', { name: /Download WAV/ });
  await expect(button).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const bytes = readFileSync((await (await downloadPromise).path())!);
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.readUInt32LE(40)).toBe(16000); // 1 s × 8 kHz × 16-bit mono
});

test('video inspector reads a real MP4', async ({ page }) => {
  await page.goto('/tools/video-inspector');
  await page.locator('input[type="file"]').setInputFiles(fixture('clip.mp4'));
  await expect(page.getByText('MPEG-4 (MP4)')).toBeVisible();
  await expect(page.getByText('64 × 48', { exact: false })).toBeVisible();
});

test('video thumbnail saves an image from a real MP4', async ({ page }) => {
  await page.goto('/tools/video-thumbnail');
  await page.locator('input[type="file"]').setInputFiles(fixture('clip.mp4'));
  await expect(page.getByRole('button', { name: 'Save this frame' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save this frame' }).click();
  const bytes = readFileSync((await (await downloadPromise).path())!);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

test('GIF frame inspector renders and downloads a decoded frame', async ({ page }) => {
  await page.goto('/tools/gif-frame-inspector');
  await page.locator('input[type="file"]').setInputFiles(fixture('anim.gif'));
  await expect(page.getByRole('img', { name: 'Frame 1 of 4' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save frame as PNG' }).click();
  const bytes = readFileSync((await (await downloadPromise).path())!);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

test('extract audio from MP4 produces a WAV soundtrack', async ({ page }) => {
  await page.goto('/tools/extract-audio');
  await page.locator('input[type="file"]').setInputFiles(fixture('clip.mp4'));
  const button = page.getByRole('button', { name: 'Download WAV' });
  await expect(button).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const bytes = readFileSync((await (await downloadPromise).path())!);
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
});
