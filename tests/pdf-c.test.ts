import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changePercent, pixelDiff } from '@/features/tools/pdf/compare';
import { findTextBoxes, rectFromPoints } from '@/features/tools/pdf/redact';

test('pixel diff counts changed pixels above the noise threshold', () => {
  const a = new Uint8ClampedArray(4 * 4).fill(255);
  const b = a.slice();
  b[0] = 0; // pixel 0 strongly changed
  b[4] = 250; // pixel 1 tiny change (noise)
  const d = pixelDiff(a, b, 2, 2);
  assert.equal(d.changed, 1);
  assert.equal(d.overlay[3], 200);
  assert.equal(d.overlay[7], 0);
  assert.equal(changePercent(1, 4), '25.0%');
  assert.equal(changePercent(1, 1e6), '<0.01%');
  assert.throws(() => pixelDiff(a, new Uint8ClampedArray(4), 2, 2));
});

test('redaction search boxes cover every case-insensitive match', () => {
  const runs = [{ str: 'Account ACME-123 and acme-123', x: 100, y: 500, width: 290, height: 10, fontSize: 10, hasEOL: false, dir: [1, 0] as [number, number] }];
  const boxes = findTextBoxes(runs, 'acme-123');
  assert.equal(boxes.length, 2);
  assert.ok(boxes[0].x < 100 + 8 * 10 && boxes[0].x + boxes[0].width > 100 + 16 * 10);
  assert.ok(boxes[0].y < 500 && boxes[0].y + boxes[0].height > 507);
  assert.deepEqual(findTextBoxes(runs, '  '), []);
  // Vertical text reading downwards (page rotated 90°): the box must be tall, not wide.
  const v = findTextBoxes([{ str: 'Bravo', x: 100, y: 300, width: 75, height: 30, fontSize: 30, hasEOL: false, dir: [0, -1] }], 'bravo')[0];
  assert.ok(v.height > 70 && v.width < 50, JSON.stringify(v));
  assert.ok(v.y < 300 - 70 && v.y + v.height >= 300 && v.x <= 100 - 30 * 0.3 + 0.01 && v.x + v.width >= 100 + 30, JSON.stringify(v));
  assert.deepEqual(rectFromPoints({ x: 10, y: 50 }, { x: 5, y: 20 }), { x: 5, y: 20, width: 5, height: 30 });
});
