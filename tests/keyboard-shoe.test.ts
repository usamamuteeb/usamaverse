import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { LAYOUTS, QWERTY_ROWS, remapPhysicalLetters } from '../features/tools/language/keyboard-layout';
import { findShoeSize, SHOE_ROWS } from '../features/tools/units/shoe-sizes';

test('layout rows cover the same physical letter keys', () => {
  for (const layout of Object.values(LAYOUTS)) {
    assert.deepEqual(layout.rows.map((row) => row.length), QWERTY_ROWS.map((row) => row.length));
  }
  assert.equal(remapPhysicalLetters('Qy', 'qwerty', 'qwertz'), 'Qz');
  assert.equal(remapPhysicalLetters('az', 'qwerty', 'azerty'), 'qw');
  assert.equal(remapPhysicalLetters('Hello!', 'qwerty', 'qwerty'), 'Hello!');
});

test('adidas adult footwear rows are aligned and size up by measured foot length', () => {
  assert.equal(SHOE_ROWS.length, 28);
  assert.deepEqual(findShoeSize('footCm', '26.3'), { footCm: 26.3, uk: 8.5, eu: '42⅔', usMen: 9, usWomen: 10 });
  assert.equal(findShoeSize('footCm', '26.4')?.footCm, 26.7);
  assert.equal(findShoeSize('eu', '42⅔')?.usMen, 9);
  assert.equal(findShoeSize('usWomen', '20'), null);
});
