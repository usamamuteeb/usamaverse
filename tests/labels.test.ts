import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { labelGeometry, labelPrintContent } from '../features/tools/misc/labels';

test('printable labels fit a measured sheet and escape user text', () => {
  const o = { paper: 'a4' as const, width: 63.5, height: 38.1, marginX: 7, marginY: 11, gapX: 2.5, gapY: 2, repeat: 2 };
  assert.equal(labelGeometry(o).cols, 3);
  const result = labelPrintContent(['<script>x</script>'], o);
  assert.equal(result.count, 2);
  assert.ok(result.html.includes('&lt;script&gt;'));
  assert.ok(!result.html.includes('<script>'));
});
