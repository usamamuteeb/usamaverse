import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCss, formatHtml, formatSql, minifyCss, minifyHtml } from '@/features/tools/developer/formatters';
import { explainCron, nextRuns, parseCron } from '@/features/tools/developer/cron';
import { parsePatch } from '@/features/tools/developer/patch';
import { buildQuery, cleanUrl, metaTags, parseDataUri, parseUserAgent, robotsTxt, sitemapXml, textToDataUri } from '@/features/tools/web/more';
import { delimiterReport, duplicates, filterTable, readTable, selectColumns, sortTable, convertDelimiter } from '@/features/tools/csv/logic';
import { textToColumns } from '@/features/tools/text/columns';
import { bitrateForSize, estimateSize, parseClock } from '@/features/tools/media/logic';
import { bytesToText, fromMorse, fromNato, gridToHtml, gridToMarkdown, inspectCodePoint, invoiceNumbers, numberToWords, textToBytes, toBraille, toMorse, toNato } from '@/features/tools/language/logic';
import { adler32, crc32, decodeKey, hex32, hmac, parseBcrypt, passwordStrength, toHex } from '@/features/tools/generators/security';
import { CODE128_PATTERNS, code128Values, eanBits, eanCheckDigit, normalizeEan } from '@/features/tools/generators/barcode';
import { encodeQr } from '@/features/tools/generators/qr';

test('HTML formatter keeps raw text, never executes', () => {
  const out = formatHtml('<div><p>Hello <b>world</b></p><script>if (a < b) { x(); }</script><br><ul><li>One</li><li>Two</li></ul></div>');
  assert.equal(out, '<div>\n  <p>Hello <b>world</b></p>\n  <script>if (a < b) { x(); }</script>\n  <br>\n  <ul>\n    <li>One</li>\n    <li>Two</li>\n  </ul>\n</div>');
  assert.equal(minifyHtml('<p>\n  a   b <!-- c -->\n</p>'), '<p> a b </p>');
});

test('CSS formatter and minifier', () => {
  const css = '/* hi */ a,b>c{color:red;margin:0 auto}@media (max-width:600px){.x{width:calc(100% - 2px)!important}}';
  assert.equal(formatCss(css), '/* hi */\na,\nb>c {\n  color: red;\n  margin: 0 auto;\n}\n\n@media (max-width:600px) {\n  .x {\n    width: calc(100% - 2px)!important;\n  }\n}');
  assert.equal(minifyCss('a , b { color : red ; margin : 0 auto ; }\n/*! keep */ .y{ font-family: Arial , sans-serif }'), 'a,b{color:red;margin:0 auto}/*! keep */.y{font-family:Arial,sans-serif}');
  assert.equal(minifyCss('.a{width:calc(1px + 2px)}'), '.a{width:calc(1px + 2px)}');
  assert.equal(minifyCss('a{content:"a ; } b"}'), 'a{content:"a ; } b"}');
  assert.throws(() => formatCss('a{color:red'), /never closed/);
});

test('SQL formatter', () => {
  const out = formatSql("select a, count(*) as n from t left join u on t.id = u.id and u.x = 'it''s' where a > 1 or b in (1, 2) group by a order by n desc;", { uppercase: true, indent: '  ' });
  assert.equal(out, "SELECT\n  a,\n  COUNT(*) AS n\nFROM t\nLEFT JOIN u\n  ON t.id = u.id\n  AND u.x = 'it''s'\nWHERE a > 1\n  OR b IN (1, 2)\nGROUP BY\n  a\nORDER BY\n  n DESC;");
});

test('cron explainer and next runs', () => {
  assert.equal(explainCron(parseCron('30 9 * * 1-5')), 'At 09:30, on Monday, Tuesday, Wednesday, Thursday and Friday.');
  assert.equal(explainCron(parseCron('*/15 * * * *')), 'Every 15 minutes.');
  assert.equal(explainCron(parseCron('@monthly')), 'At 00:00, on day-of-month 1.');
  assert.match(explainCron(parseCron('0 0 13 * 5')), /OR on any Friday/);
  const runs = nextRuns(parseCron('0 12 * * 0'), new Date(2026, 9, 19, 10, 0));
  assert.equal(runs[0].getDay(), 0);
  assert.equal(runs[0].getHours(), 12);
  assert.equal(runs.length, 5);
  assert.deepEqual(parseCron('0 0 * * 7').dow.values, [0]);
  assert.deepEqual(parseCron('0 0 * jan,MAR mon-wed').month.values, [1, 3]);
  assert.throws(() => parseCron('0 0 * * * *'), /6 fields/);
  assert.throws(() => parseCron('61 * * * *'), /outside/);
  assert.throws(() => parseCron('0 0 L * *'), /Quartz/);
});

test('unified diff parser', () => {
  const files = parsePatch('diff --git a/x.txt b/x.txt\nindex 1..2 100644\n--- a/x.txt\n+++ b/x.txt\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n');
  assert.equal(files.length, 1);
  assert.equal(files[0].newPath, 'x.txt');
  assert.deepEqual([files[0].added, files[0].removed], [1, 1]);
  assert.deepEqual(files[0].hunks[0].lines.map((l) => `${l.type}${l.oldNo ?? ''}/${l.newNo ?? ''}`), ['ctx1/1', 'del2/', 'add/2', 'ctx3/3']);
  assert.equal(parsePatch('--- /dev/null\n+++ b/new.md\n@@ -0,0 +1 @@\n+hi\n')[0].status, 'added');
  assert.throws(() => parsePatch('hello'), /No unified diff/);
});

test('web helpers', () => {
  assert.equal(buildQuery('https://a.b/p?x=1', [{ key: 'tag', value: 'a b' }, { key: 'tag', value: 'c&d' }], true), 'https://a.b/p?x=1&tag=a+b&tag=c%26d');
  assert.equal(buildQuery('', [{ key: 'q', value: 'é' }], false), '?q=%C3%A9');
  const c = cleanUrl('https://shop.com/item?id=5&utm_source=x&fbclid=abc&ref=home#reviews', ['utm', 'ads']);
  assert.equal(c.url, 'https://shop.com/item?id=5&ref=home#reviews');
  assert.deepEqual(c.removed, ['utm_source', 'fbclid']);
  assert.equal(cleanUrl('https://a.com/?utm_x=1', ['utm']).url, 'https://a.com/');
  const m = metaTags({ title: 'A "quoted" <title>', description: 'd', url: 'https://a.com', image: 'rel.png', imageAlt: '', siteName: '', type: 'website', twitterCard: '', twitterSite: '', locale: '' });
  assert.ok(m.html.includes('content="A &quot;quoted&quot; &lt;title&gt;"'));
  assert.ok(m.warnings.some((w) => w.includes('absolute')));
  assert.equal(robotsTxt([{ agent: '*', allow: '', disallow: '/admin\n/tmp' }], 'https://a.com/sitemap.xml'), 'User-agent: *\nDisallow: /admin\nDisallow: /tmp\n\nSitemap: https://a.com/sitemap.xml\n');
  const sm = sitemapXml('https://a.com/\nhttps://a.com/?a=1&b=2\nhttps://a.com/', { lastmod: '2026-10-19', changefreq: 'weekly', priority: '' });
  assert.equal(sm.count, 2);
  assert.ok(sm.xml.includes('<loc>https://a.com/?a=1&amp;b=2</loc>'));
  const ua = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0');
  assert.deepEqual([ua.browser, ua.engine, ua.os, ua.device], ['Microsoft Edge', 'Blink', 'Windows 10 or 11', 'Desktop']);
  assert.equal(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1').engine, 'WebKit');
  const d = parseDataUri('data:text/plain;charset=utf-8,h%C3%A9llo');
  assert.equal(new TextDecoder().decode(d.bytes), 'héllo');
  assert.equal(new TextDecoder().decode(parseDataUri(textToDataUri('héllo', 'text/plain', true)).bytes), 'héllo');
});

test('CSV table operations', () => {
  const t = readTable('name,age,city\nAli,30,Lahore\nsara,25,Karachi\nALI,30,Lahore\nOmar,,Multan', 'auto', true);
  assert.equal(selectColumns(t, [2, 0]), 'city,name\r\nLahore,Ali\r\nKarachi,sara\r\nLahore,ALI\r\nMultan,Omar');
  const d = duplicates(t, [0, 1], { ignoreCase: true, trim: true });
  assert.equal(d.duplicateRows, 1);
  assert.equal(sortTable(t, 1, { mode: 'number', desc: false, emptyLast: true }).split('\r\n').map((r) => r.split(',')[0]).join(' '), 'name sara Ali ALI Omar');
  assert.equal(filterTable(t, 2, 'equals', 'lahore', true).kept, 2);
  assert.equal(filterTable(t, 1, 'gt', '26', false).kept, 2);
  assert.equal(delimiterReport('a;b\n1;2').find((r) => r.delimiter === ';')!.columns, 2);
  assert.equal(convertDelimiter('a\tb\n"x,y"\tz', 'tab', ','), 'a,b\r\n"x,y",z');
});

test('text to columns', () => {
  assert.equal(textToColumns('a,bb\nccc,d', { split: 'comma', custom: '', output: 'aligned', trim: true }).output, 'a    bb\nccc  d');
  assert.equal(textToColumns('x y  z', { split: 'spaces', custom: '', output: 'markdown', trim: true }).output, '| x   | y   | z   |\n| --- | --- | --- |');
});

test('media estimates', () => {
  assert.equal(Math.round(estimateSize({ videoKbps: 5000, audioKbps: 128, seconds: 600, overheadPct: 0 }).bytes), 384_600_000);
  assert.equal(Math.round(bitrateForSize({ targetBytes: 100e6, seconds: 100, audioKbps: 0, overheadPct: 0 }).videoKbps), 8000);
  assert.equal(parseClock('1:02:03'), 3723);
  assert.equal(parseClock('90'), 5400);
});

test('morse, NATO, braille, bytes', () => {
  assert.equal(toMorse('SOS, hi').output, '... --- ... --..-- / .... ..');
  assert.equal(fromMorse('... --- ... / .... ..'), 'SOS HI');
  assert.throws(() => fromMorse('.-.-.-.-.-'), /not a known/);
  assert.equal(toNato('Ab 9'), 'Alfa Bravo (space) Niner');
  assert.equal(fromNato('alpha bravo (space) nine'), 'AB 9');
  assert.equal(toBraille('Hi 12').output, '⠠⠓⠊⠀⠼⠁⠃');
  assert.equal(textToBytes('Hé', 'hex'), '48 C3 A9');
  assert.equal(textToBytes('A', 'binary'), '01000001');
  assert.equal(bytesToText('48C3A9', 'hex'), 'Hé');
  assert.equal(bytesToText('01001000 01101001', 'binary'), 'Hi');
  assert.throws(() => bytesToText('C3', 'hex'), /not valid UTF-8/);
});

test('number to words', () => {
  assert.equal(numberToWords('1234567', { ordinal: false, british: false }), 'one million two hundred thirty-four thousand five hundred sixty-seven');
  assert.equal(numberToWords('1005', { ordinal: false, british: true }), 'one thousand and five');
  assert.equal(numberToWords('342', { ordinal: false, british: true }), 'three hundred and forty-two');
  assert.equal(numberToWords('-3.14', { ordinal: false, british: false }), 'minus three point one four');
  assert.equal(numberToWords('21', { ordinal: true, british: false }), 'twenty-first');
  assert.equal(numberToWords('112', { ordinal: true, british: false }), 'one hundred twelfth');
  assert.equal(numberToWords('40', { ordinal: true, british: false }), 'fortieth');
  assert.equal(numberToWords('0', { ordinal: false, british: false }), 'zero');
});

test('unicode inspector', () => {
  const e = inspectCodePoint('é');
  assert.deepEqual([e.codePoint, e.category, e.script, e.utf8], ['U+00E9', 'Lowercase letter', 'Latin', 'C3 A9']);
  assert.equal(inspectCodePoint('😀').jsEscape, '\\u{1F600}');
  assert.equal(inspectCodePoint('​').category, 'Format character (invisible)');
});

test('invoice numbers, markdown and HTML tables', () => {
  assert.deepEqual(invoiceNumbers('INV-{YYYY}{MM}-{SEQ:4}', 7, 2, 1, new Date(2026, 9, 19)), ['INV-202610-0007', 'INV-202610-0008']);
  assert.throws(() => invoiceNumbers('INV-{FOO}-{SEQ}', 1, 1, 1, new Date()), /Unknown placeholder/);
  assert.equal(gridToMarkdown([['a', 'b|c'], ['1', '2']], ['left', 'right']), '| a   | b\\|c |\n| :-- | ---: |\n| 1   | 2    |');
  assert.ok(gridToHtml([['<b>', 'x']], { header: true, caption: '', className: '' }).includes('<th scope="col">&lt;b&gt;</th>'));
});

test('CRC32, Adler-32, HMAC known vectors', async () => {
  const enc = new TextEncoder();
  assert.equal(hex32(crc32(enc.encode('123456789'))), 'cbf43926');
  assert.equal(hex32(crc32(enc.encode('6789'), crc32(enc.encode('12345')))), 'cbf43926');
  assert.equal(hex32(adler32(enc.encode('Wikipedia'))), '11e60398');
  // RFC 4231 test case 2
  const mac = await hmac('what do ya want for nothing?', decodeKey('Jefe', 'text'), 'SHA-256');
  assert.equal(toHex(mac), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  assert.deepEqual([...decodeKey('0x0a0B', 'hex')], [10, 11]);
});

test('bcrypt parsing and strength meter', () => {
  const b = parseBcrypt('$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW');
  assert.deepEqual([b.version, b.cost, b.rounds, b.salt.length, b.hash.length], ['2b', 12, 4096, 22, 31]);
  assert.equal(passwordStrength('password1').score, 0);
  assert.equal(passwordStrength('P@ssw0rd').score, 0);
  assert.equal(passwordStrength('Password123!').score, 0);
  assert.equal(passwordStrength('Qwerty2026').score, 0);
  assert.ok(passwordStrength('correct-horse-battery-staple-91!').score >= 3);
  assert.ok(passwordStrength('qwerty2024').warnings.length >= 2);
});

test('barcode tables', () => {
  assert.equal(CODE128_PATTERNS.length, 107);
  CODE128_PATTERNS.forEach((p, i) => assert.equal([...p].reduce((a, b) => a + Number(b), 0), i === 106 ? 13 : 11, `pattern ${i}`));
  assert.equal(new Set(CODE128_PATTERNS).size, 107);
  // Code 128B "PJJ123C": weighted checksum
  const v = code128Values('PJJ123C');
  assert.equal(v[v.length - 2], 55); // 104+48+84+126+68+90+114+245 = 879 ≡ 55 (mod 103)
  assert.deepEqual(code128Values('1234567890').slice(0, 6), [105, 12, 34, 56, 78, 90]);
  assert.equal(eanCheckDigit('400638133393'), 1);
  assert.equal(normalizeEan('4006381333931', 'ean13'), '4006381333931');
  assert.throws(() => normalizeEan('4006381333932', 'ean13'), /Check digit/);
  assert.equal(normalizeEan('03600029145', 'upca'), '0036000291452');
  assert.equal(eanBits('4006381333931').length, 95);
});

test('QR encoder picks sensible versions', () => {
  assert.equal(encodeQr('HELLO WORLD', 'Q').version, 1);
  assert.equal(encodeQr('HELLO WORLD', 'Q').mode, 'alphanumeric');
  assert.equal(encodeQr('01234567', 'M').mode, 'numeric');
  assert.equal(encodeQr('https://example.com/é', 'M').mode, 'byte');
  assert.equal(encodeQr('a'.repeat(2953), 'L').version, 40);
  assert.throws(() => encodeQr('a'.repeat(2954), 'L'), /Too much data/);
});

import { code128Widths } from '@/features/tools/generators/barcode';

/** Independent Code 128 decoder (widths → text) used to round-trip the encoder. */
function decode128(widths: number[]): string {
  const vals: number[] = [];
  for (let i = 0; i < widths.length; ) {
    const len = i + 7 === widths.length ? 7 : 6;
    vals.push(CODE128_PATTERNS.indexOf(widths.slice(i, i + len).join('')));
    i += len;
  }
  assert.equal(vals.at(-1), 106, 'stop');
  const check = vals.at(-2)!;
  const body = vals.slice(0, -2);
  assert.equal(body.reduce((s, v, k) => s + v * (k === 0 ? 1 : k), 0) % 103, check, 'checksum');
  let set = body[0] === 105 ? 'C' : 'B';
  let out = '';
  for (const v of body.slice(1)) {
    if (set === 'C' && v === 100) set = 'B';
    else if (set === 'B' && v === 99) set = 'C';
    else out += set === 'C' ? String(v).padStart(2, '0') : String.fromCharCode(v + 32);
  }
  return out;
}

test('Code 128 round-trips through an independent decoder', () => {
  for (const t of ['Hello-128', '1234567890', 'AB12345678cd', '99x', 'x12345', '123', 'a b~!', '0000', '12345']) assert.equal(decode128(code128Widths(t)), t);
});
