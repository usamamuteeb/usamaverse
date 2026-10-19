import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linesToMarkdown, linesToText, runsToLines } from '@/features/tools/pdf/text';
import type { TextRun } from '@/features/tools/pdf/pdfjs';

const run = (str: string, x: number, y: number, fontSize = 11, width = str.length * fontSize * 0.5): TextRun => ({ str, x, y, width, height: fontSize, fontSize, hasEOL: false, dir: [1, 0] as [number, number] });

test('runs are ordered into lines with spaces where gaps are', () => {
  const lines = runsToLines([run('world', 60, 700), run('Hello', 10, 700.5), run('Second line', 10, 686)]);
  assert.deepEqual(lines.map((l) => l.text), ['Hello world', 'Second line']);
});

test('paragraph breaks from vertical gaps; headings, lists and hyphenation in Markdown', () => {
  const runs = [
    run('Annual Report', 10, 760, 24),
    run('This is a para-', 10, 720), run('graph that wraps.', 10, 707),
    run('Next paragraph # here.', 10, 670),
    run('• First item', 10, 640), run('• Second item', 10, 627),
    run('1. Numbered', 10, 600),
  ];
  const lines = runsToLines(runs);
  const md = linesToMarkdown(lines);
  assert.match(md, /^# Annual Report/);
  assert.match(md, /This is a paragraph that wraps\./);
  assert.match(md, /- First item\n- Second item/);
  assert.match(md, /1\. Numbered/);
  assert.match(linesToText(lines), /Annual Report\n\nThis is a para-\ngraph that wraps\./);
  assert.equal(runsToLines([]).length, 0);
});
