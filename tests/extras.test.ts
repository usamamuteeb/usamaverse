import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals, money, num, sampleInvoice } from '@/features/tools/misc/invoice';
import { simulateHex, matrixFor } from '@/features/tools/color/cvd';
import { placeholderSvg } from '@/features/tools/image/placeholder-image';

test('invoice totals are exact in minor units', () => {
  const inv = { ...sampleInvoice(), discount: '10', shipping: '5', items: [{ description: 'A', qty: '3', price: '0.1', tax: '20' }, { description: 'B', qty: '1', price: '19.99', tax: '0' }] };
  const t = computeTotals(inv);
  assert.deepEqual([t.subtotal, t.discount, t.tax, t.shipping, t.total], [2029, 203, 5, 500, 2331]);
  assert.equal(money(t.total, 'EUR', t.digits), '€23.31');
  assert.equal(computeTotals({ ...inv, currency: 'JPY', items: [{ description: 'x', qty: '2', price: '1500', tax: '10' }], discount: '', shipping: '' }).total, 3300);
  assert.deepEqual(computeTotals({ ...inv, items: [{ description: 'x', qty: 'two', price: '5', tax: '0' }] }).errors.length, 1);
  assert.equal(num('1,234.50'), 1234.5);
  assert.equal(num('12,5'), 12.5);
  assert.ok(Number.isNaN(num('12a')));
});

test('colour-vision simulation keeps greys and changes reds', () => {
  for (const k of ['protan', 'deutan', 'tritan', 'achroma'] as const) assert.equal(simulateHex('#808080', k), '#808080');
  assert.notEqual(simulateHex('#ff0000', 'deutan'), '#ff0000');
  assert.equal(simulateHex('#ff0000', 'deutan', 0), '#ff0000');
  assert.deepEqual(matrixFor('protan', 0), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
});

test('placeholder SVG escapes its label', () => {
  const svg = placeholderSvg(300, 200, '#eeeeee', '#333333', '<b>&');
  assert.ok(svg.includes('&lt;b&gt;&amp;') && svg.startsWith('<svg') && svg.includes('width="300"'));
});
