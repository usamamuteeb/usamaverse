import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  base64DecodeText, base64EncodeText, csvToJson, decodeJwt, formatJson, fromTimestamp, hasUnsafeIntegers,
  htmlDecode, htmlEncode, jsonToCsv, urlDecode, urlEncode,
} from '@/features/tools/developer/logic';
import { renderMarkdown, safeUrl } from '@/features/tools/developer/markdown';
import { formatXml } from '@/features/tools/developer/xml';

test('JSON format, sort and error location', () => {
  assert.equal(formatJson('{"b":1,"a":[1,2]}', { indent: '2', sortKeys: true }), '{\n  "a": [\n    1,\n    2\n  ],\n  "b": 1\n}');
  assert.equal(formatJson('{ "a" : 1 }', { indent: 'minify', sortKeys: false }), '{"a":1}');
  assert.throws(() => formatJson('{\n  "a": 1,\n}', { indent: '2', sortKeys: false }), /Invalid JSON \((line 3|end)/);
  assert.equal(hasUnsafeIntegers('{"id": 12345678901234567890}'), true);
  assert.equal(hasUnsafeIntegers('{"id": "12345678901234567890", "n": 42}'), false);
});

test('JSON → CSV quotes commas, quotes and newlines', () => {
  const r = jsonToCsv('[{"name":"A, B","note":"say \\"hi\\""},{"name":"C","extra":"line1\\nline2"}]');
  assert.equal(r.output, 'name,note,extra\r\n"A, B","say ""hi""",\r\nC,,"line1\nline2"');
  assert.equal(r.columns, 3);
});

test('CSV → JSON round trip with quoted newlines', () => {
  const csv = 'id,text\r\n1,"multi\nline, with comma"\r\n2,"quote "" here"\r\n';
  const r = csvToJson(csv, { delimiter: 'auto', header: true });
  assert.deepEqual(JSON.parse(r.output), [{ id: '1', text: 'multi\nline, with comma' }, { id: '2', text: 'quote " here' }]);
  assert.throws(() => csvToJson('a,"b', { delimiter: ',', header: true }), /never closed/);
});

test('HTML entities', () => {
  assert.equal(htmlEncode('<a href="x">Tom & Jerry\'s</a>', { nonAscii: false }), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
  assert.equal(htmlEncode('é😀', { nonAscii: true }), '&#xE9;&#x1F600;');
  assert.equal(htmlDecode('&lt;b&gt; &amp;amp; &#x1F600; &#233; &copy; &bogus;'), '<b> &amp; 😀 é © &bogus;');
});

test('URL encode/decode', () => {
  assert.equal(urlEncode("a b&c/d?é!'", 'component'), 'a%20b%26c%2Fd%3F%C3%A9%21%27');
  assert.equal(urlEncode('a b', 'form'), 'a+b');
  assert.equal(urlDecode('a+b%20c', 'form'), 'a b c');
  assert.throws(() => urlDecode('%E0%A4%A', 'component'), /Malformed/);
});

test('Base64 UTF-8 text', () => {
  assert.equal(base64EncodeText('héllo 👋', false), 'aMOpbGxvIPCfkYs=');
  assert.equal(base64EncodeText('héllo 👋', true), 'aMOpbGxvIPCfkYs');
  assert.equal(base64DecodeText('aMOpbGxvIPCfkYs'), 'héllo 👋');
  assert.throws(() => base64DecodeText('@@@'), /not valid Base64/);
  assert.throws(() => base64DecodeText('/w=='), /not valid UTF-8/);
});

test('JWT decode (no verification)', () => {
  const enc = (o: object) => base64EncodeText(JSON.stringify(o), true);
  const token = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: '1', exp: 1000 })}.sig`;
  const d = decodeJwt(`Bearer ${token}`, 2_000_000);
  assert.deepEqual(d.header, { alg: 'HS256', typ: 'JWT' });
  assert.equal(d.times[0].note, 'expired');
  assert.throws(() => decodeJwt('a.b'), /3 parts/);
  assert.throws(() => decodeJwt('a.b.c.d.e'), /JWE/);
});

test('Unix timestamps', () => {
  assert.equal(new Date(fromTimestamp('1700000000', 'auto').ms).toISOString(), '2023-11-14T22:13:20.000Z');
  assert.equal(fromTimestamp('1700000000000', 'auto').unitUsed, 'ms');
  assert.throws(() => fromTimestamp('abc', 'auto'));
});

test('Markdown preview never emits raw HTML or unsafe links', () => {
  const html = renderMarkdown('# Hi <script>alert(1)</script>\n\n[x](javascript:alert(1)) [y](JaVa\tScRiPt:alert(1)) [ok](https://a.b/?q=1&r=2)\n\n<img src=x onerror=alert(1)>\n\n![pic](https://example.com/a.png)');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.ok(!/href="javascript/i.test(html));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<a href="https://a.b/?q=1&amp;r=2"'));
  assert.ok(html.includes('Image: pic'));
  assert.equal(safeUrl('data:text/html,x'), null);
});

test('Markdown blocks', () => {
  const html = renderMarkdown('## T\n\n- a\n- **b**\n\n1. one\n2. two\n\n> quote\n\n```js\nconst a = 1 < 2;\n```\n\n| a | b |\n|---|--:|\n| 1 | 2 |');
  assert.match(html, /<h2>T<\/h2>/);
  assert.match(html, /<ul><li>a<\/li><li><strong>b<\/strong><\/li><\/ul>/);
  assert.match(html, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
  assert.match(html, /<blockquote><p>quote<\/p><\/blockquote>/);
  assert.match(html, /<pre><code class="language-js">const a = 1 &lt; 2;<\/code><\/pre>/);
  assert.match(html, /<td style="text-align:right">2<\/td>/);
});

test('XML formatter', () => {
  assert.equal(formatXml('<?xml version="1.0"?><a x="1"><b>t</b><c/><!-- n --></a>', { indent: '2' }), '<?xml version="1.0"?>\n<a x="1">\n  <b>t</b>\n  <c/>\n  <!-- n -->\n</a>');
  assert.equal(formatXml('<a>\n  <b> t </b>\n  <!-- c -->\n</a>', { indent: 'minify' }), '<a><b>t</b></a>');
  assert.throws(() => formatXml('<a><b></a>', { indent: '2' }), /Expected <\/b>/);
  assert.throws(() => formatXml('<a></a><b/>', { indent: '2' }), /one root/);
  assert.throws(() => formatXml('<a>x & y</a>', { indent: '2' }), /&amp;/);
  assert.throws(() => formatXml('<a b=1/>', { indent: '2' }), /Malformed attribute/);
});
