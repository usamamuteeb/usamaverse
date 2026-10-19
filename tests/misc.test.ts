import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addToDate, ageOn, dateDifference, formatClock, formatYMD } from '@/features/tools/dates/logic';
import { buildUtm, extractUrls, parseUrlParts } from '@/features/tools/web/logic';
import { detectSignature, looksLikeText } from '@/features/tools/files/logic';
import { detectDelimiter, parseCsv, toCsv, uniqueHeaders } from '@/lib/tools/shared/csv';

test('date difference ignores DST and handles calendar borrowing', () => {
  // Spans the US/EU DST changes; still exactly 1 day each.
  assert.equal(dateDifference('2026-03-07', '2026-03-08').totalDays, 1);
  assert.equal(dateDifference('2026-10-24', '2026-10-25').totalDays, 1);
  const d = dateDifference('2024-01-31', '2024-03-01');
  assert.deepEqual([d.years, d.months, d.days, d.totalDays], [0, 1, 1, 30]);
  assert.equal(dateDifference('2026-01-10', '2026-01-01').sign, -1);
  assert.throws(() => dateDifference('2026-02-30', '2026-03-01'), /does not exist/);
});

test('adding months clamps; year rollover', () => {
  assert.deepEqual(addToDate('2024-01-31', 1, 'months'), { result: { y: 2024, m: 2, d: 29 }, clamped: true });
  assert.equal(formatYMD(addToDate('2026-12-31', 1, 'days').result), '2027-01-01');
  assert.equal(formatYMD(addToDate('2026-01-15', -1, 'months').result), '2025-12-15');
  assert.equal(formatYMD(addToDate('2024-02-29', 1, 'years').result), '2025-02-28');
});

test('age calculator and leap-day birthdays', () => {
  const a = ageOn('2000-02-29', '2026-10-19');
  assert.deepEqual([a.years, a.months, a.days], [26, 7, 20]);
  const b = ageOn('2000-02-29', '2027-01-01');
  assert.equal(formatYMD(b.nextBirthday), '2027-02-28');
  assert.throws(() => ageOn('2030-01-01', '2026-01-01'));
});

test('clock format', () => {
  assert.equal(formatClock(3_723_456), '01:02:03.45');
});

test('URL parser keeps repeated params and never fetches', () => {
  const p = parseUrlParts('https://user:pw@example.com:8443/a%20b?x=1&x=2&y=#frag');
  assert.equal(p.hasPassword, true);
  assert.equal(p.port, '8443');
  assert.equal(p.decodedPath, '/a b');
  assert.deepEqual(p.params.map((q) => [q.key, q.value]), [['x', '1'], ['x', '2'], ['y', '']]);
  assert.throws(() => parseUrlParts('example.com/a'), /Add a scheme/);
});

test('UTM builder', () => {
  const u = buildUtm('https://example.com/p?a=1', { source: 'news letter', medium: 'email', campaign: 'spring', term: '', content: '', id: '' });
  assert.equal(u, 'https://example.com/p?a=1&utm_source=news+letter&utm_medium=email&utm_campaign=spring');
  assert.throws(() => buildUtm('javascript:alert(1)', { source: 'a', medium: 'b', campaign: 'c', term: '', content: '', id: '' }));
});

test('URL extractor trims punctuation and dedupes domains', () => {
  const text = 'See (https://en.wikipedia.org/wiki/Foo_(bar)). Also www.example.com, and https://example.com/x?y=1.';
  assert.deepEqual(extractUrls(text, { unique: true, mode: 'urls' }), ['https://en.wikipedia.org/wiki/Foo_(bar)', 'www.example.com', 'https://example.com/x?y=1']);
  assert.deepEqual(extractUrls(text, { unique: true, mode: 'domains' }), ['en.wikipedia.org', 'example.com']);
});

test('file signatures', () => {
  assert.equal(detectSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))!.mime, 'image/png');
  assert.equal(detectSignature(new TextEncoder().encode('%PDF-1.7'))!.mime, 'application/pdf');
  assert.equal(detectSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))!.mime, 'application/zip');
  assert.equal(detectSignature(new TextEncoder().encode('hello')), null);
  assert.equal(looksLikeText(new TextEncoder().encode('héllo')), true);
  assert.equal(looksLikeText(new TextEncoder().encode('hé').subarray(0, 2)), true); // cut multi-byte char
  assert.equal(looksLikeText(new Uint8Array([0x68, 0x00, 0x69])), false);
});

test('RFC 4180 CSV parsing', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi"""\n"multi\nline",z'), [['a', 'b'], ['x, y', 'say "hi"'], ['multi\nline', 'z']]);
  assert.deepEqual(parseCsv('a,b\n'), [['a', 'b']]);
  assert.deepEqual(parseCsv('a,,\n'), [['a', '', '']]);
  assert.deepEqual(parseCsv('﻿a;b', ';'), [['a', 'b']]);
  assert.throws(() => parseCsv('"open'), /never closed/);
  assert.equal(toCsv([['a,b', 'c"d', 'e\nf', 'g']]), '"a,b","c""d","e\nf",g');
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(detectDelimiter('a\tb\n1\t"x,y,z"'), '\t');
  assert.equal(detectDelimiter('"a,b";c;d\n1;2;3'), ';');
  assert.deepEqual(uniqueHeaders(['', 'id', 'id']), ['column_1', 'id', 'id_2']);
});

import { csvToMarkdown } from '@/features/tools/csv/logic';
import { fitDimensions, outputName } from '@/features/tools/image/logic';

test('CSV → Markdown escapes pipes and pads ragged rows', () => {
  assert.equal(csvToMarkdown('a,b\n"x|y",z\n1', { delimiter: ',', header: true, align: 'none' }), '| a | b |\n| --- | --- |\n| x\\|y | z |\n| 1 |  |');
});

test('image fit dimensions', () => {
  assert.deepEqual(fitDimensions(400, 200, 100, null, true), { width: 100, height: 50 });
  assert.deepEqual(fitDimensions(400, 200, 100, 100, true), { width: 100, height: 50 });
  assert.deepEqual(fitDimensions(400, 200, 100, 100, false), { width: 100, height: 100 });
  assert.throws(() => fitDimensions(400, 200, 20000, null, true), /limited/);
  assert.equal(outputName('photo.final.PNG', 'image/jpeg', ''), 'photo.final.jpg');
});
