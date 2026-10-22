import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml, parseYamlAll, stringifyYaml, YamlError } from '@/features/tools/developer/yaml';
import { compactJs, formatJs, tokenize } from '@/features/tools/developer/js-format';
import { analyzeHtml } from '@/features/tools/web/html-analyze';
import { minifyPath, optimizeSvg } from '@/features/tools/image/svg-optimize';
import { TASKS, checkFormula, criterion, explainFormula, isRef, withSep } from '@/features/tools/csv/formula';

test('yaml: maps, lists, scalars, blocks, anchors and merge keys', () => {
  const v = parseYaml(`name: demo
port: 8080
ratio: 0.5
on: yes
empty:
nulls: ~
list: [a, "b c", 3]
nested:
  - id: 1
    tags: [x]
  - id: 2
text: |
  line one
  line two
folded: >
  joined
  together
base: &b {region: eu, retries: 3}
prod:
  <<: *b
  retries: 5
`);
  assert.deepEqual(v, {
    name: 'demo', port: 8080, ratio: 0.5, on: 'yes', empty: null, nulls: null,
    list: ['a', 'b c', 3], nested: [{ id: 1, tags: ['x'] }, { id: 2 }],
    text: 'line one\nline two\n', folded: 'joined together\n',
    base: { region: 'eu', retries: 3 }, prod: { region: 'eu', retries: 5 },
  });
  assert.equal(parseYamlAll('a: 1\n---\nb: 2\n').length, 2);
});

test('yaml: errors carry line numbers', () => {
  for (const [src, line] of [['a: 1\na: 2', 2], ['a:\n\tb: 1', 2], ['list: [1, 2', 1], ['x: 1\n  y: 2', 2]] as const) {
    assert.throws(() => parseYaml(src), (e: unknown) => e instanceof YamlError && e.line === line, src);
  }
});

test('yaml: stringify round-trips', () => {
  const data = { a: 'text: with colon', b: ['1', 2, true, null], c: { d: 'multi\nline\n' }, e: '', f: 'yes' };
  assert.deepEqual(parseYaml(stringifyYaml(data)), data);
});

test('js formatter keeps every token and lays code out', () => {
  const src = "function f(a,b){if(a>b){return a}else{return b}}const o={x:1,y:[1,2]};const re=/a\\/b/g;let s=`t ${a+`n`}`;switch(k){case 1:go();break;default:stop()}";
  const out = formatJs(src);
  const sig = (s: string) => tokenize(s).filter((t) => !['ws', 'nl', 'comment', 'lcomment'].includes(t.t)).map((t) => t.v);
  assert.deepEqual(sig(out), sig(src));
  assert.match(out, /^function f\(a, b\) \{\n  if \(a > b\) \{\n    return a\n  \} else \{/);
  assert.match(out, /const o = \{ x: 1, y: \[1, 2\] \};/);
  assert.match(out, /case 1:\n    go\(\);\n    break;\n  default:\n    stop\(\)/);
  assert.match(out, /const re = \/a\\\/b\/g;/);
  assert.match(formatJs('const m: Map<string, Array<number>> = new Map<string, Array<number>>();'), /Map<string, Array<number>> = new Map<string, Array<number>>\(\)/);
  assert.equal(compactJs('// c\nconst a = 1;  /* x */\n\nlet b = a + +1;\n'), 'const a=1;\nlet b=a+ +1;\n');
});

test('html analyzer finds common problems', () => {
  const r = analyzeHtml('<!doctype html><html><head><title>T</title></head><body><h1>A</h1><h3>B</h3><img src="x.png"><a href="/a"></a><a href="#" target="_blank">click here</a><input name="q"><p id="d"></p><p id="d"></p><script src="http://x.test/a.js"></script></body></html>');
  const msgs = r.findings.map((f) => f.message).join('\n');
  assert.match(msgs, /no lang attribute/);
  assert.match(msgs, /jumps from h1 to h3/);
  assert.match(msgs, /no alt attribute/);
  assert.match(msgs, /has no text or aria-label/);
  assert.match(msgs, /no linked <label>/);
  assert.match(msgs, /id="d" is used 2 times/);
  assert.match(msgs, /plain http/);
  assert.equal(r.headings.length, 2);
  assert.equal(r.links.length, 2);
  // a wrapped image names its link
  assert.equal(analyzeHtml('<a href="/"><img src="l.png" alt="Home"></a>').links[0].text, 'Home');
  assert.ok(!analyzeHtml('<p>Hi <b>there</b></p>').findings.some((f) => f.severity === 'error'));
});

test('svg optimizer removes unsafe parts and keeps the drawing', () => {
  const r = optimizeSvg('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" onload="evil()" viewBox="0 0 10.000 10"><script>evil()</script><foreignObject/><a xlink:href="javascript:evil()"><path id="p" d="M 1.0000 1.0000 L 9.123456 9.000" onclick="x()"/></a><image href="https://tracker.test/p.gif"/><use xlink:href="#p"/><style>@import url(http://x.test/a.css);.a{fill:red}</style><!-- note --></svg>');
  assert.ok(!/script|onload|onclick|javascript|foreignObject|tracker|@import|ENTITY|<!--/i.test(r.svg), r.svg);
  assert.match(r.svg, /<path id="p" d="M1 1 9.123 9"\/>/);
  assert.match(r.svg, /viewBox="0 0 10 10"/);
  assert.ok(r.removed.length >= 6);
  assert.ok(r.after < r.before);
  assert.throws(() => optimizeSvg('<html></html>'), /not <svg>/);
  // relative coordinates are rounded against the rounded pen position (no drift)
  assert.equal(minifyPath('m0 0 l0.333 0 0.333 0 0.333 0', 2), 'm0 0 .33 0 .34 0 .33 0');
  assert.equal(minifyPath('M10 10 a5 5 0 01 10 0', 2), 'M10 10a5 5 0 0 1 10 0');
});

test('formula helper builds valid formulas', () => {
  const s = { app: 'excel' as const, sep: ',' as const, modern: true };
  for (const t of TASKS) {
    const v = Object.fromEntries(t.fields.map((f) => [f.key, f.default]));
    for (const modern of [true, false]) {
      const r = t.build(v, { ...s, modern });
      assert.ok(r.formula.startsWith('='), t.id);
      assert.deepEqual(checkFormula(r.formula), [], `${t.id}: ${r.formula}`);
    }
  }
  assert.equal(criterion('gt', '100'), '">100"');
  assert.equal(criterion('contains', 'pro'), '"*pro*"');
  assert.equal(criterion('ge', 'E1'), '">="&E1');
  assert.equal(withSep('=IF(A1, "a,b", 2)', ';'), '=IF(A1; "a,b"; 2)');
  assert.ok(isRef("'My Sheet'!A2:B9") && isRef('B:B') && !isRef('Yes'));
  assert.deepEqual(explainFormula('=IFERROR(VLOOKUP(A2, B:C, 2, FALSE), "x(y)")').map((e) => e.name), ['IFERROR', 'VLOOKUP']);
  assert.match(checkFormula('=SUM(A1:A3')[0], /not closed/);
});
