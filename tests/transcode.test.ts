import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mediaCommand } from '../features/tools/media/transcode';

test('video commands use bounded trim and remove the audio stream on mute', () => {
  assert.deepEqual(mediaCommand('trim', 'in.mp4', 'out.mp4', { start: 1.25, end: 2.5 }).slice(0, 6), ['-ss', '1.25', '-i', 'in.mp4', '-t', '1.25']);
  assert.throws(() => mediaCommand('trim', 'in.mp4', 'out.mp4', { start: 3, end: 2 }), /valid segment/);
  assert.ok(mediaCommand('mute', 'in.mp4', 'out.mp4', {}).includes('-an'));
  assert.ok(mediaCommand('convert', 'in.mp4', 'out.mp3', { format: 'mp3' }).includes('libmp3lame'));
});
