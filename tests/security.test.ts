import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entropyBits, generatePassword, hashText, pins, randomNumbers, randomStrings, uuids } from '@/features/tools/generators/logic';
import { randomIndex } from '@/lib/tools/shared/random';

test('secure generators never call Math.random', () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error('Math.random must not be used');
  };
  try {
    const p = generatePassword({ length: 24, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: true });
    assert.equal(p.length, 24);
    assert.match(p, /[a-z]/);
    assert.match(p, /[A-Z]/);
    assert.match(p, /\d/);
    assert.match(p, /[^a-zA-Z0-9]/);
    assert.doesNotMatch(p, /[Il1O0o]/);
    assert.equal(new Set(randomNumbers({ min: 1, max: 10, count: 10, unique: true, sort: true })).size, 10);
    assert.match(uuids(1, false, true)[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.match(pins(6, 1)[0], /^\d{6}$/);
    assert.match(randomStrings({ length: 32, count: 1, charset: 'hex', custom: '' })[0], /^[0-9a-f]{32}$/);
  } finally {
    Math.random = original;
  }
});

test('generators fail closed without Web Crypto', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  try {
    assert.throws(() => pins(4, 1), /secure random generator/);
  } finally {
    Object.defineProperty(globalThis, 'crypto', desc);
  }
});

test('randomIndex is roughly uniform (no modulo bias smoke test)', () => {
  const counts = [0, 0, 0];
  for (let i = 0; i < 30000; i++) counts[randomIndex(3)]++;
  counts.forEach((c) => assert.ok(c > 9000 && c < 11000, `count ${c}`));
});

test('validation', () => {
  assert.throws(() => randomNumbers({ min: 1, max: 3, count: 5, unique: true, sort: false }), /Only 3 unique/);
  assert.throws(() => generatePassword({ length: 12, lower: false, upper: false, digits: false, symbols: false, excludeAmbiguous: false }));
  assert.equal(Math.round(entropyBits(16, 62)), 95);
});

test('SHA hashes match known vectors', async () => {
  assert.equal(await hashText('abc', 'SHA-256'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await hashText('', 'SHA-1'), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
});
