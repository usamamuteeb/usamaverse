import { randomChoice, randomIndex, shuffle } from '@/lib/tools/shared/random';

// ---------------------------------------------------------------- Unicode helpers

const hasSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl;

/** User-perceived characters (grapheme clusters). */
export function graphemes(s: string): string[] {
  if (!s) return [];
  if (hasSegmenter) return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment);
  return Array.from(s);
}

export function splitLines(s: string): string[] {
  return s.split(/\r\n|\r|\n/);
}

export function countWords(s: string): number {
  if (!s.trim()) return 0;
  if (hasSegmenter) {
    let n = 0;
    for (const seg of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(s)) if (seg.isWordLike) n++;
    return n;
  }
  return (s.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

function countSentences(s: string): number {
  if (!s.trim()) return 0;
  if (hasSegmenter) {
    let n = 0;
    for (const seg of new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(s)) if (/[\p{L}\p{N}]/u.test(seg.segment)) n++;
    return n;
  }
  return s.split(/[.!?]+(?:\s|$)/).filter((x) => /[\p{L}\p{N}]/u.test(x)).length;
}

// ---------------------------------------------------------------- Counters

export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  bytes: number;
}

export function textStats(s: string): TextStats {
  const g = graphemes(s);
  return {
    words: countWords(s),
    characters: g.length,
    charactersNoSpaces: g.filter((c) => !/^\s+$/u.test(c)).length,
    sentences: countSentences(s),
    paragraphs: s.trim() ? s.split(/(?:\r\n|\r|\n)\s*(?:\r\n|\r|\n)/).filter((p) => p.trim()).length : 0,
    lines: s === '' ? 0 : splitLines(s).length,
    bytes: new TextEncoder().encode(s).length,
  };
}

export interface LineStats {
  total: number;
  nonEmpty: number;
  blank: number;
  unique: number;
  longest: number;
  longestLineNumber: number;
}

export function lineStats(s: string): LineStats {
  if (s === '') return { total: 0, nonEmpty: 0, blank: 0, unique: 0, longest: 0, longestLineNumber: 0 };
  const lines = splitLines(s);
  let longest = 0;
  let longestLineNumber = 0;
  lines.forEach((l, i) => {
    const len = graphemes(l).length;
    if (len > longest) {
      longest = len;
      longestLineNumber = i + 1;
    }
  });
  const blank = lines.filter((l) => l.trim() === '').length;
  return { total: lines.length, nonEmpty: lines.length - blank, blank, unique: new Set(lines).size, longest, longestLineNumber };
}

export function readingTime(s: string, wpm = 238, speakWpm = 130) {
  if (!(wpm > 0) || !(speakWpm > 0)) throw new Error('Words per minute must be greater than zero.');
  const words = countWords(s);
  return { words, readSeconds: Math.round((words / wpm) * 60), speakSeconds: Math.round((words / speakWpm) * 60) };
}

export function formatMinutes(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  return [h ? `${h} hr` : '', m ? `${m} min` : '', sec ? `${sec} sec` : ''].filter(Boolean).join(' ');
}

export interface CharCount {
  char: string;
  count: number;
  percent: number;
}

export function charFrequency(s: string, opts: { ignoreCase: boolean; ignoreWhitespace: boolean }): CharCount[] {
  const map = new Map<string, number>();
  let total = 0;
  for (let g of graphemes(s)) {
    if (opts.ignoreWhitespace && /^\s+$/u.test(g)) continue;
    if (opts.ignoreCase) g = g.toLocaleLowerCase();
    map.set(g, (map.get(g) ?? 0) + 1);
    total++;
  }
  return [...map.entries()]
    .map(([char, count]) => ({ char, count, percent: total ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count || a.char.localeCompare(b.char));
}

// ---------------------------------------------------------------- Case

export type CaseMode = 'upper' | 'lower' | 'title' | 'sentence' | 'camel' | 'pascal' | 'snake' | 'kebab' | 'constant';

export function splitIdentifierWords(s: string): string[] {
  return s
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const cap = (w: string) => {
  const g = graphemes(w);
  return g.length ? g[0].toUpperCase() + g.slice(1).join('').toLowerCase() : w;
};

export function convertCase(s: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper':
      return s.toUpperCase();
    case 'lower':
      return s.toLowerCase();
    case 'title':
      return s.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase());
    case 'sentence':
      return s.toLowerCase().replace(/(^\s*|[.!?]\s+|(?:\r\n|\r|\n)\s*)(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase());
    default:
      return splitLines(s)
        .map((line) => {
          const words = splitIdentifierWords(line);
          if (!words.length) return line.trim() === '' ? '' : line;
          switch (mode) {
            case 'camel':
              return words.map((w, i) => (i === 0 ? w.toLowerCase() : cap(w))).join('');
            case 'pascal':
              return words.map(cap).join('');
            case 'snake':
              return words.map((w) => w.toLowerCase()).join('_');
            case 'kebab':
              return words.map((w) => w.toLowerCase()).join('-');
            case 'constant':
              return words.map((w) => w.toUpperCase()).join('_');
          }
        })
        .join('\n');
  }
}

// ---------------------------------------------------------------- Cleaning

export interface WhitespaceOptions {
  trimLines: boolean;
  collapseSpaces: boolean;
  tabsToSpaces: boolean;
  removeInvisible: boolean;
  trimDocument: boolean;
}

export function cleanWhitespace(s: string, o: WhitespaceOptions): string {
  let out = s.replace(/\r\n|\r/g, '\n');
  if (o.removeInvisible) out = out.replace(/[​-‍⁠﻿]/g, '').replace(/[  -   　]/g, ' ');
  if (o.tabsToSpaces) out = out.replace(/\t/g, ' ');
  let lines = out.split('\n');
  if (o.collapseSpaces) lines = lines.map((l) => l.replace(/[ \t]{2,}/g, ' '));
  if (o.trimLines) lines = lines.map((l) => l.trim());
  else lines = lines.map((l) => l.replace(/[ \t]+$/, ''));
  out = lines.join('\n');
  return o.trimDocument ? out.trim() : out;
}

export function dedupeLines(s: string, o: { caseSensitive: boolean; trim: boolean; keepBlank: boolean }) {
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;
  for (const line of splitLines(s)) {
    if (o.keepBlank && line.trim() === '') {
      out.push(line);
      continue;
    }
    let key = o.trim ? line.trim() : line;
    if (!o.caseSensitive) key = key.toLocaleLowerCase();
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    out.push(line);
  }
  return { output: out.join('\n'), removed };
}

export type SortMode = 'az' | 'za' | 'natural' | 'length' | 'length-desc' | 'reverse' | 'shuffle';

export function sortLines(s: string, o: { mode: SortMode; caseSensitive: boolean; removeEmpty: boolean }): string {
  let lines = splitLines(s);
  if (o.removeEmpty) lines = lines.filter((l) => l.trim() !== '');
  const collator = new Intl.Collator(undefined, { sensitivity: o.caseSensitive ? 'variant' : 'base', numeric: o.mode === 'natural' });
  const len = (l: string) => graphemes(l).length;
  switch (o.mode) {
    case 'az':
    case 'natural':
      return lines.map((l, i) => [l, i] as const).sort((a, b) => collator.compare(a[0], b[0]) || a[1] - b[1]).map((x) => x[0]).join('\n');
    case 'za':
      return lines.map((l, i) => [l, i] as const).sort((a, b) => collator.compare(b[0], a[0]) || a[1] - b[1]).map((x) => x[0]).join('\n');
    case 'length':
      return lines.map((l, i) => [l, i] as const).sort((a, b) => len(a[0]) - len(b[0]) || a[1] - b[1]).map((x) => x[0]).join('\n');
    case 'length-desc':
      return lines.map((l, i) => [l, i] as const).sort((a, b) => len(b[0]) - len(a[0]) || a[1] - b[1]).map((x) => x[0]).join('\n');
    case 'reverse':
      return lines.reverse().join('\n');
    case 'shuffle':
      return shuffle(lines).join('\n');
  }
}

export function removeBlankLines(s: string, o: { whitespaceIsBlank: boolean; collapse: boolean }) {
  const isBlank = (l: string) => (o.whitespaceIsBlank ? l.trim() === '' : l === '');
  const out: string[] = [];
  let removed = 0;
  let prevBlank = false;
  for (const line of splitLines(s)) {
    if (isBlank(line)) {
      if (o.collapse && !prevBlank && out.length > 0) out.push('');
      else removed++;
      prevBlank = true;
      continue;
    }
    prevBlank = false;
    out.push(line);
  }
  if (o.collapse && out[out.length - 1] === '') {
    out.pop();
    removed++;
  }
  return { output: out.join('\n'), removed };
}

// ---------------------------------------------------------------- Find & replace

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findReplace(s: string, find: string, replacement: string, o: { caseSensitive: boolean; wholeWord: boolean }) {
  if (!find) throw new Error('Enter the text to find.');
  let pattern = escapeRegExp(find);
  if (o.wholeWord) pattern = `(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`;
  const re = new RegExp(pattern, `gu${o.caseSensitive ? '' : 'i'}`);
  let count = 0;
  const output = s.replace(re, () => {
    count++;
    return replacement; // function form: "$&" etc. are inserted literally
  });
  return { output, count };
}

// ---------------------------------------------------------------- Slug

export function slugify(s: string, o: { separator: '-' | '_'; lowercase: boolean; maxLength: number }): string {
  const sep = o.separator;
  let out = s
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/ß/g, 'ss')
    .replace(/æ/gi, (m) => (m === 'Æ' ? 'AE' : 'ae'))
    .replace(/ø/gi, (m) => (m === 'Ø' ? 'O' : 'o'))
    .replace(/đ/gi, (m) => (m === 'Đ' ? 'D' : 'd'))
    .replace(/ł/gi, (m) => (m === 'Ł' ? 'L' : 'l'))
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, sep)
    .replace(new RegExp(`\\${sep}{2,}`, 'g'), sep)
    .replace(new RegExp(`^\\${sep}|\\${sep}$`, 'g'), '');
  if (o.lowercase) out = out.toLowerCase();
  if (o.maxLength > 0 && out.length > o.maxLength) {
    out = out.slice(0, o.maxLength);
    const cut = out.lastIndexOf(sep);
    if (cut > o.maxLength * 0.5) out = out.slice(0, cut);
    out = out.replace(new RegExp(`\\${sep}+$`), '');
  }
  return out;
}

// ---------------------------------------------------------------- Reverse

export type ReverseMode = 'characters' | 'words' | 'lines';

export function reverseText(s: string, mode: ReverseMode): string {
  if (mode === 'lines') return splitLines(s).reverse().join('\n');
  if (mode === 'words') return splitLines(s).map((l) => l.split(/(\s+)/).reverse().join('')).join('\n');
  return graphemes(s).reverse().join('');
}

// ---------------------------------------------------------------- Lorem ipsum

const LOREM_WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in ' +
  'reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa ' +
  'qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nulla gravida orci a odio nullam varius ' +
  'turpis et commodo pharetra est eros bibendum elit nec luctus magna felis sollicitudin mauris integer'
).split(' ');

const OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

function sentence(): string {
  const n = 6 + randomIndex(10);
  const words = Array.from({ length: n }, () => randomChoice(LOREM_WORDS));
  if (n > 8 && randomIndex(2) === 0) words[3 + randomIndex(n - 5)] += ',';
  const s = words.join(' ');
  return s[0].toUpperCase() + s.slice(1) + '.';
}

export function lorem(kind: 'paragraphs' | 'sentences' | 'words', count: number, startWithLorem: boolean): string {
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('Choose a count from 1 to 500.');
  if (kind === 'words') {
    const words = Array.from({ length: count }, () => randomChoice(LOREM_WORDS));
    if (startWithLorem) OPENING.toLowerCase().replace(',', '').split(' ').slice(0, count).forEach((w, i) => (words[i] = w));
    const s = words.join(' ');
    return s[0].toUpperCase() + s.slice(1);
  }
  const sentences = (n: number) => Array.from({ length: n }, sentence);
  if (kind === 'sentences') {
    const list = sentences(count);
    if (startWithLorem) list[0] = OPENING + '.';
    return list.join(' ');
  }
  const paras = Array.from({ length: count }, () => sentences(4 + randomIndex(4)));
  if (startWithLorem) paras[0][0] = OPENING + '.';
  return paras.map((p) => p.join(' ')).join('\n\n');
}

// ---------------------------------------------------------------- Diff

export type DiffOp = { type: 'equal' | 'add' | 'remove'; text: string; a?: number; b?: number };

export const DIFF_LIMIT = 4_000_000;

export function lineDiff(left: string, right: string, o: { ignoreCase: boolean; ignoreWhitespace: boolean } = { ignoreCase: false, ignoreWhitespace: false }): DiffOp[] {
  const A = left === '' ? [] : splitLines(left);
  const B = right === '' ? [] : splitLines(right);
  const key = (l: string) => {
    let k = o.ignoreWhitespace ? l.replace(/\s+/g, ' ').trim() : l;
    if (o.ignoreCase) k = k.toLocaleLowerCase();
    return k;
  };
  const a = A.map(key);
  const b = B.map(key);

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const n = endA - start;
  const m = endB - start;
  if (n * m > DIFF_LIMIT) throw new Error(`Too many changed lines to compare in the browser (${n.toLocaleString()} × ${m.toLocaleString()}). Try smaller sections.`);

  const ops: DiffOp[] = [];
  for (let i = 0; i < start; i++) ops.push({ type: 'equal', text: B[i], a: i + 1, b: i + 1 });

  // LCS table over the middle section.
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = a[start + i] === b[start + j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[start + i] === b[start + j]) {
      ops.push({ type: 'equal', text: B[start + j], a: start + i + 1, b: start + j + 1 });
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      ops.push({ type: 'remove', text: A[start + i], a: start + i + 1 });
      i++;
    } else {
      ops.push({ type: 'add', text: B[start + j], b: start + j + 1 });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: 'remove', text: A[start + i], a: start + i + 1 });
    i++;
  }
  while (j < m) {
    ops.push({ type: 'add', text: B[start + j], b: start + j + 1 });
    j++;
  }
  for (let k = 0; k < a.length - endA; k++) ops.push({ type: 'equal', text: B[endB + k], a: endA + k + 1, b: endB + k + 1 });
  return ops;
}

export function diffToUnifiedText(ops: DiffOp[]): string {
  return ops.map((op) => (op.type === 'add' ? '+ ' : op.type === 'remove' ? '- ' : '  ') + op.text).join('\n');
}
