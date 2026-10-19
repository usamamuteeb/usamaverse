import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  basicStats, bigToBase, discount, evaluate, fromRoman, parseBigInBase, parseNumberList, percentChange,
  salesTax, tip, toRoman, whatPercent,
} from '@/features/tools/math/logic';
import { QUANTITIES, convert } from '@/features/tools/units/logic';
import { contrastRatio, gradientCss, parseColor, rgbToHsl, simplifyRatio, toHex, toHslString, wcagResults } from '@/features/tools/color/logic';
import { formatBytes, formatNumber } from '@/lib/format';

test('calculator evaluates without eval and handles precedence', () => {
  assert.equal(formatNumber(evaluate('0.1 + 0.2')), '0.3');
  assert.equal(evaluate('2 + 3 × 4'), 14);
  assert.equal(evaluate('(2 + 3) * 4'), 20);
  assert.equal(evaluate('-2^2'), -4);
  assert.equal(evaluate('2^3^2'), 512);
  assert.equal(evaluate('2**-1'), 0.5);
  assert.equal(evaluate('50% * 80'), 40);
  assert.equal(evaluate('1,000 ÷ 8'), 125);
  assert.throws(() => evaluate('1/0'), /Division by zero/);
  assert.throws(() => evaluate('2(3)'), /Missing operator/);
  assert.throws(() => evaluate('alert(1)'), /Unexpected/);
  assert.throws(() => evaluate('(1+2'), /closing parenthesis/);
});

test('percent, tip, discount, tax', () => {
  assert.equal(whatPercent(25, 200), 12.5);
  assert.equal(percentChange(80, 100), 25);
  assert.equal(percentChange(-50, -25), 50);
  assert.deepEqual(tip(100, 15, 4), { tip: 15, total: 115, perPerson: 28.75, tipPerPerson: 3.75 });
  assert.equal(formatNumber(discount(200, 20, 10).final), '144');
  assert.equal(formatNumber(salesTax(110, 10, 'extract').net), '100');
  assert.equal(formatNumber(salesTax(100, 8.25, 'add').gross), '108.25');
});

test('stats and number lists', () => {
  assert.deepEqual(basicStats(parseNumberList('1, 2\n3;4 5')), { count: 5, sum: 15, mean: 3, min: 1, max: 5 });
  assert.throws(() => parseNumberList('1 two 3'), /“two” is not a number/);
});

test('number bases with BigInt', () => {
  assert.equal(bigToBase(parseBigInBase('ff', 16), 2), '11111111');
  assert.equal(bigToBase(parseBigInBase('0x1F', 16), 10), '31');
  assert.equal(bigToBase(parseBigInBase('-1010', 2), 10), '-10');
  assert.equal(bigToBase(parseBigInBase('123456789012345678901234567890', 10), 16), '18ee90ff6c373e0ee4e3f0ad2');
  assert.throws(() => parseBigInBase('12', 2), /not a valid digit/);
});

test('roman numerals', () => {
  assert.equal(toRoman(1994), 'MCMXCIV');
  assert.equal(fromRoman('mmxxvi'), 2026);
  assert.throws(() => fromRoman('IIII'));
  assert.throws(() => toRoman(4000));
});

test('temperature uses offsets and rejects below absolute zero', () => {
  const t = QUANTITIES.temperature;
  assert.equal(convert(t, 100, 'C', 'F'), 212);
  assert.equal(formatNumber(convert(t, -40, 'F', 'C')), '-40');
  assert.equal(formatNumber(convert(t, 0, 'C', 'K')), '273.15');
  assert.equal(formatNumber(convert(t, 491.67, 'R', 'C')), '0');
  assert.throws(() => convert(t, -300, 'C', 'K'), /absolute zero/);
});

test('length, mass, volume, data sizes', () => {
  assert.equal(formatNumber(convert(QUANTITIES.length, 1, 'in', 'cm')), '2.54');
  assert.equal(formatNumber(convert(QUANTITIES.length, 1, 'mi', 'km')), '1.609344');
  assert.equal(formatNumber(convert(QUANTITIES.mass, 1, 'lb', 'g')), '453.59237');
  assert.equal(formatNumber(convert(QUANTITIES.volume, 1, 'usgal', 'l')), '3.785411784');
  assert.equal(convert(QUANTITIES.data, 1, 'GiB', 'B'), 1073741824);
  assert.equal(formatNumber(convert(QUANTITIES.data, 1, 'GB', 'GiB')), '0.931322574615');
  assert.equal(convert(QUANTITIES.data, 8, 'bit', 'B'), 1);
  assert.equal(formatBytes(1500), '1.50 kB (1.46 KiB)');
  assert.equal(formatBytes(512), '512 B');
});

test('colors and WCAG contrast', () => {
  assert.deepEqual(parseColor('#C6283D'), { r: 198, g: 40, b: 61, a: 1 });
  assert.deepEqual(parseColor('rgb(10 20 30 / 50%)'), { r: 10, g: 20, b: 30, a: 0.5 });
  assert.equal(toHex(parseColor('hsl(0, 100%, 50%)')!), '#ff0000');
  assert.equal(toHslString(parseColor('#00ff00')!), 'hsl(120 100% 50%)');
  assert.deepEqual(rgbToHsl(255, 255, 255), { h: 0, s: 0, l: 100 });
  assert.equal(parseColor('not a color'), null);
  const ratio = contrastRatio(parseColor('#000')!, parseColor('#fff')!);
  assert.equal(Math.round(ratio * 100) / 100, 21);
  assert.equal(Math.round(contrastRatio(parseColor('#767676')!, parseColor('#fff')!) * 100) / 100, 4.54);
  assert.equal(wcagResults(4.5).find((r) => r.label === 'Normal text — AA')!.pass, true);
  // Brand tokens: text on bg and muted on bg must pass AA.
  assert.ok(contrastRatio(parseColor('#F5F0F2')!, parseColor('#0B0A0D')!) >= 7);
  assert.ok(contrastRatio(parseColor('#B7AEB3')!, parseColor('#0B0A0D')!) >= 4.5);
  assert.ok(contrastRatio(parseColor('#F04459')!, parseColor('#0B0A0D')!) >= 4.5);
});

test('gradients and ratios', () => {
  assert.equal(gradientCss({ type: 'linear', angle: 90, shape: 'circle', stops: [{ color: '#fff', pos: 100 }, { color: 'red', pos: 0 }] }), 'linear-gradient(90deg, #ff0000 0%, #ffffff 100%)');
  assert.deepEqual(simplifyRatio(1920, 1080), [16, 9]);
  assert.deepEqual(simplifyRatio(2.35, 1), [47, 20]);
});
