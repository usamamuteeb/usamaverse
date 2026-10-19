import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  charFrequency, convertCase, cleanWhitespace, dedupeLines, findReplace, graphemes, lineDiff, lineStats,
  lorem, readingTime, removeBlankLines, reverseText, slugify, sortLines, textStats,
} from '@/features/tools/text/logic';

test('graphemes keep emoji ZWJ sequences, skin tones and combining marks whole', () => {
  assert.deepEqual(graphemes('👨‍👩‍👧👍🏽é'), ['👨‍👩‍👧', '👍🏽', 'é']);
});

test('grapheme-safe reversal', () => {
  assert.equal(reverseText('ab👍🏽é', 'characters'), 'é👍🏽ba');
  assert.equal(reverseText('🇵🇰🇺🇸', 'characters'), '🇺🇸🇵🇰');
  assert.equal(reverseText('one two  three', 'words'), 'three  two one');
  assert.equal(reverseText('a\nb\nc', 'lines'), 'c\nb\na');
});

test('textStats counts words, graphemes, bytes', () => {
  const s = textStats('Hello, world! 👍🏽\n\nSecond paragraph.');
  assert.equal(s.words, 4);
  assert.equal(s.characters, 34);
  assert.equal(s.paragraphs, 2);
  assert.equal(s.lines, 3);
  assert.equal(s.sentences, 2);
  assert.equal(textStats('').words, 0);
  assert.equal(textStats('é').bytes, 2);
});

test('lineStats', () => {
  assert.deepEqual(lineStats('a\n\nbbb\na'), { total: 4, nonEmpty: 3, blank: 1, unique: 3, longest: 3, longestLineNumber: 3 });
});

test('case conversion', () => {
  assert.equal(convertCase('hello wORLD', 'title'), 'Hello World');
  assert.equal(convertCase("don't stop", 'title'), "Don't Stop");
  assert.equal(convertCase('hello. how ARE you? fine', 'sentence'), 'Hello. How are you? Fine');
  assert.equal(convertCase('XMLHttpRequest parser', 'snake'), 'xml_http_request_parser');
  assert.equal(convertCase('user id number', 'camel'), 'userIdNumber');
  assert.equal(convertCase('user-id_number', 'pascal'), 'UserIdNumber');
  assert.equal(convertCase('Hello World', 'kebab'), 'hello-world');
  assert.equal(convertCase('max retry count', 'constant'), 'MAX_RETRY_COUNT');
  assert.equal(convertCase('café au lait', 'camel'), 'caféAuLait');
});

test('whitespace cleaner', () => {
  const o = { trimLines: true, collapseSpaces: true, tabsToSpaces: true, removeInvisible: true, trimDocument: true };
  assert.equal(cleanWhitespace('  a \t  b​ \r\n c d  ', o), 'a b\nc d');
});

test('dedupe keeps first occurrence and order', () => {
  const r = dedupeLines('b\na\nB\na\n', { caseSensitive: false, trim: true, keepBlank: true });
  assert.equal(r.output, 'b\na\n');
  assert.equal(r.removed, 2);
});

test('sorting: natural and stable', () => {
  assert.equal(sortLines('file10\nfile2\nfile1', { mode: 'natural', caseSensitive: false, removeEmpty: false }), 'file1\nfile2\nfile10');
  assert.equal(sortLines('b\nA\na', { mode: 'az', caseSensitive: false, removeEmpty: false }), 'A\na\nb');
  const shuffled = sortLines('1\n2\n3\n4', { mode: 'shuffle', caseSensitive: false, removeEmpty: false }).split('\n').sort();
  assert.deepEqual(shuffled, ['1', '2', '3', '4']);
});

test('remove blank lines / collapse', () => {
  assert.equal(removeBlankLines('a\n\n \nb\n', { whitespaceIsBlank: true, collapse: false }).output, 'a\nb');
  assert.equal(removeBlankLines('a\n\n\n\nb', { whitespaceIsBlank: true, collapse: true }).output, 'a\n\nb');
});

test('find & replace is literal and whole-word aware', () => {
  assert.deepEqual(findReplace('a.b a.b', 'a.b', '$&x', { caseSensitive: true, wholeWord: false }), { output: '$&x $&x', count: 2 });
  assert.equal(findReplace('cat catalog Cat', 'cat', 'dog', { caseSensitive: false, wholeWord: true }).output, 'dog catalog dog');
  assert.throws(() => findReplace('x', '', 'y', { caseSensitive: true, wholeWord: false }));
});

test('slugify', () => {
  const o = { separator: '-' as const, lowercase: true, maxLength: 0 };
  assert.equal(slugify('  Crème Brûlée & Café — Straße 2026!  ', o), 'creme-brulee-and-cafe-strasse-2026');
  assert.equal(slugify("Don't stop", o), 'dont-stop');
  assert.equal(slugify('one two three four', { ...o, maxLength: 9 }), 'one-two');
});

test('reading time', () => {
  const r = readingTime(Array(476).fill('word').join(' '));
  assert.equal(r.readSeconds, 120);
});

test('lorem generator', () => {
  assert.match(lorem('sentences', 2, true), /^Lorem ipsum dolor sit amet, consectetur adipiscing elit\. [A-Z]/);
  assert.equal(lorem('words', 5, true), 'Lorem ipsum dolor sit amet');
  assert.equal(lorem('paragraphs', 3, false).split('\n\n').length, 3);
});

test('line diff', () => {
  const ops = lineDiff('a\nb\nc', 'a\nx\nc');
  assert.deepEqual(ops.map((o) => `${o.type}:${o.text}`), ['equal:a', 'remove:b', 'add:x', 'equal:c']);
  assert.deepEqual(lineDiff('', 'a').map((o) => o.type), ['add']);
  assert.deepEqual(lineDiff('A ', 'a', { ignoreCase: true, ignoreWhitespace: true }).map((o) => o.type), ['equal']);
});

test('char frequency counts emoji as one character', () => {
  const f = charFrequency('aA👍🏽👍🏽 ', { ignoreCase: true, ignoreWhitespace: true });
  assert.deepEqual(f.map((x) => [x.char, x.count]), [['👍🏽', 2], ['a', 2]].sort((p, q) => String(p[0]).localeCompare(String(q[0]))));
});
