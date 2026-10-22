/**
 * A dependency-free YAML 1.2 reader/writer for everyday config files:
 * block mappings and sequences, flow [..] / {..}, plain/single/double-quoted
 * scalars, literal | and folded > blocks, comments, anchors & aliases, multiple
 * documents. Values follow the YAML 1.2 core schema (null, bool, int, float).
 * Merge keys (<<: *anchor) are applied. Not supported (reported as errors):
 * complex "? " keys and custom tags beyond !!str/!!int/!!float/!!bool/!!null.
 */

export type YamlValue = null | boolean | number | string | YamlValue[] | { [k: string]: YamlValue };

export class YamlError extends Error {
  constructor(message: string, public line: number, public column = 1) {
    super(`Line ${line}${column > 1 ? `, column ${column}` : ''}: ${message}`);
    this.name = 'YamlError';
  }
}

interface Line {
  n: number; // 1-based line number
  indent: number;
  text: string; // content after indentation, comments stripped (except inside block scalars)
  raw: string;
}

const NULLS = new Set(['', '~', 'null', 'Null', 'NULL']);

export function resolveScalar(s: string): YamlValue {
  if (NULLS.has(s)) return null;
  if (/^(true|True|TRUE)$/.test(s)) return true;
  if (/^(false|False|FALSE)$/.test(s)) return false;
  if (/^[-+]?[0-9]+$/.test(s)) {
    const n = Number(s);
    return Number.isSafeInteger(n) ? n : s;
  }
  if (/^0o[0-7]+$/.test(s)) return parseInt(s.slice(2), 8);
  if (/^0x[0-9a-fA-F]+$/.test(s)) return parseInt(s.slice(2), 16);
  if (/^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/.test(s)) return Number(s);
  if (/^[-+]?\.(inf|Inf|INF)$/.test(s)) return s.startsWith('-') ? -Infinity : Infinity;
  if (/^\.(nan|NaN|NAN)$/.test(s)) return NaN;
  return s;
}

/** Removes a trailing comment (" #…") that is outside quotes. */
function stripComment(s: string): string {
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '\\' && q === '"') i++;
      else if (c === q) {
        if (q === "'" && s[i + 1] === "'") i++;
        else q = null;
      }
    } else if (c === '"' || c === "'") {
      // quotes only start a scalar at a token start
      if (i === 0 || /[\s:[{,-]/.test(s[i - 1])) q = c;
    } else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).replace(/\s+$/, '');
  }
  return s.replace(/\s+$/, '');
}

function unescapeDouble(s: string, line: number): string {
  return s.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g, (_m, e: string) => {
    switch (e[0]) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      case '0':
        return '\0';
      case 'b':
        return '\b';
      case 'e':
        return '\x1b';
      case '"':
        return '"';
      case '\\':
        return '\\';
      case '/':
        return '/';
      case ' ':
        return ' ';
      case 'N':
        return '\u0085';
      case '_':
        return ' ';
      case 'x':
      case 'u':
      case 'U':
        return String.fromCodePoint(parseInt(e.slice(1), 16));
      default:
        throw new YamlError(`Unknown escape “\\${e}” in a double-quoted string.`, line);
    }
  });
}

class Parser {
  private lines: Line[] = [];
  private i = 0;
  private anchors = new Map<string, YamlValue>();

  constructor(private src: string[], private startLine: number) {
    src.forEach((raw, k) => {
      const n = startLine + k;
      const m = /^( *)(.*)$/.exec(raw)!;
      if (/^ *\t/.test(raw) && raw.trim()) {
        const t = raw.replace(/^ */, '');
        if (/^\t/.test(t) && !/^\s*#/.test(raw)) throw new YamlError('Tabs cannot be used for indentation in YAML — use spaces.', n);
      }
      this.lines.push({ n, indent: m[1].length, text: stripComment(m[2]), raw });
    });
  }

  private skipBlank() {
    while (this.i < this.lines.length && this.lines[this.i].text === '') this.i++;
  }

  private peek(): Line | undefined {
    this.skipBlank();
    return this.lines[this.i];
  }

  parseDocument(): YamlValue {
    const first = this.peek();
    if (!first) return null;
    const v = this.parseNode(first.indent, -1);
    const rest = this.peek();
    if (rest) throw new YamlError(`Unexpected content “${rest.text.slice(0, 40)}” — check the indentation.`, rest.n, rest.indent + 1);
    return v;
  }

  /** Parses the node whose first line starts at `indent` (already known to be > parentIndent). */
  private parseNode(indent: number, parentIndent: number): YamlValue {
    const line = this.peek();
    if (!line || line.indent <= parentIndent) return null;
    if (/^-( |$)/.test(line.text)) return this.parseSeq(line.indent);
    if (this.keyOf(line.text)) return this.parseMap(line.indent);
    return this.parseInlineValue(line.text, line, line.indent, parentIndent, true);
  }

  /** Returns [key, rest] when a line is "key: value". */
  private keyOf(text: string): [string, string] | null {
    if (text.startsWith('? ')) return null;
    let key: string;
    let rest: string;
    if (text[0] === '"' || text[0] === "'") {
      const q = text[0];
      let j = 1;
      for (; j < text.length; j++) {
        if (q === '"' && text[j] === '\\') {
          j++;
          continue;
        }
        if (text[j] === q) {
          if (q === "'" && text[j + 1] === "'") {
            j++;
            continue;
          }
          break;
        }
      }
      const after = text.slice(j + 1);
      const m = /^\s*:(\s|$)/.exec(after);
      if (!m) return null;
      const inner = text.slice(1, j);
      key = q === '"' ? unescapeDouble(inner, 0) : inner.replace(/''/g, "'");
      rest = after.slice(m[0].length).trim();
      return [key, rest];
    }
    if (/^[[{]/.test(text)) return null;
    const m = /^([^#]*?)\s*:(\s+|$)/.exec(text);
    if (!m || m[1] === '' || /^[-]\s/.test(text)) return null;
    key = m[1];
    rest = text.slice(m[0].length).trim();
    return [key, rest];
  }

  private parseMap(indent: number): YamlValue {
    const out: Record<string, YamlValue> = {};
    const merged = new Set<string>(); // keys that came from "<<" and may still be overridden
    for (;;) {
      const line = this.peek();
      if (!line || line.indent < indent) break;
      if (line.indent > indent) throw new YamlError('This line is indented more than the keys above it.', line.n, line.indent + 1);
      const kv = this.keyOf(line.text);
      if (!kv) {
        if (/^-( |$)/.test(line.text)) throw new YamlError('A list item appears where a “key: value” was expected.', line.n, line.indent + 1);
        throw new YamlError(`Expected “key: value” but found “${line.text.slice(0, 40)}”.`, line.n, line.indent + 1);
      }
      const [key, rest] = kv;
      this.i++;
      if (key === '<<') {
        const v = this.parseValueAfter(rest, line, indent, true);
        const sources = Array.isArray(v) ? v : [v];
        for (const src of sources) {
          if (!src || typeof src !== 'object' || Array.isArray(src)) throw new YamlError('A merge key (<<) needs a map or a list of maps.', line.n, line.indent + 1);
          for (const [k, val] of Object.entries(src)) {
            if (Object.prototype.hasOwnProperty.call(out, k)) continue;
            out[k] = val;
            merged.add(k);
          }
        }
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(out, key) && !merged.has(key)) throw new YamlError(`Duplicate key “${key}”.`, line.n, line.indent + 1);
      merged.delete(key);
      out[key] = this.parseValueAfter(rest, line, indent, true);
    }
    return out;
  }

  private parseSeq(indent: number): YamlValue {
    const out: YamlValue[] = [];
    for (;;) {
      const line = this.peek();
      if (!line || line.indent < indent || !/^-( |$)/.test(line.text)) {
        if (line && line.indent === indent && !/^-( |$)/.test(line.text) && line.indent > 0 && out.length) break;
        break;
      }
      if (line.indent > indent) throw new YamlError('List item indented more than the items above it.', line.n, line.indent + 1);
      const rest = line.text.slice(1).replace(/^ +/, '');
      const offset = line.text.length - rest.length; // "- " width
      if (rest === '') {
        this.i++;
        out.push(this.parseNode(indent + 1, indent));
        continue;
      }
      // "- key: value" or "- - x": continue as a node that starts at the item's column
      if (this.keyOf(rest) || /^-( |$)/.test(rest)) {
        this.lines[this.i] = { ...line, indent: indent + offset, text: rest };
        out.push(this.parseNode(indent + offset, indent));
        continue;
      }
      this.i++;
      out.push(this.parseValueAfter(rest, line, indent, false));
    }
    return out;
  }

  /** Value after "key:" or "- " on the same line (may continue on following lines). */
  private parseValueAfter(rest: string, line: Line, indent: number, inMap: boolean): YamlValue {
    let text = rest;
    let anchor: string | null = null;
    let tag: string | null = null;
    for (;;) {
      const a = /^&([^\s,[\]{}]+)\s*/.exec(text);
      if (a) {
        anchor = a[1];
        text = text.slice(a[0].length);
        continue;
      }
      const t = /^!(!?[^\s]*)\s*/.exec(text);
      if (t) {
        tag = t[1];
        text = text.slice(t[0].length);
        continue;
      }
      break;
    }
    let value: YamlValue;
    if (text === '') {
      const next = this.peek();
      if (next && (next.indent > indent || (inMap && next.indent === indent && /^-( |$)/.test(next.text)))) value = this.parseNode(next.indent, inMap && next.indent === indent ? indent - 1 : indent);
      else value = null;
    } else value = this.parseInlineValue(text, line, indent, indent, false);
    if (tag) value = applyTag(tag, value, line.n);
    if (anchor) this.anchors.set(anchor, value);
    return value;
  }

  private parseInlineValue(text: string, line: Line, indent: number, parentIndent: number, firstLineConsumed: boolean): YamlValue {
    if (firstLineConsumed) this.i++;
    if (text.startsWith('*')) {
      const name = text.slice(1).trim();
      if (!this.anchors.has(name)) throw new YamlError(`Unknown alias “*${name}”.`, line.n);
      return structuredClone(this.anchors.get(name)!);
    }
    if (/^[|>]/.test(text)) return this.blockScalar(text, line, parentIndent);
    if (text[0] === '[' || text[0] === '{') {
      let buf = text;
      while (!balanced(buf) && this.i < this.lines.length) {
        const l = this.lines[this.i++];
        buf += ` ${l.text}`;
      }
      return new FlowParser(buf, line.n, this.anchors).parseAll();
    }
    if (text[0] === '"' || text[0] === "'") {
      const q = text[0];
      let buf = text;
      while (!closedQuote(buf, q) && this.i < this.lines.length) {
        const l = this.lines[this.i++];
        buf += l.raw.trim() === '' ? '\n' : ` ${l.raw.trim()}`;
      }
      if (!closedQuote(buf, q)) throw new YamlError('A quoted string is not closed.', line.n);
      const end = closedQuote(buf, q)!;
      const tail = buf.slice(end + 1).trim();
      if (tail && !tail.startsWith('#')) throw new YamlError(`Unexpected text “${tail.slice(0, 30)}” after a quoted string.`, line.n);
      const inner = buf.slice(1, end).replace(/ ?\n ?/g, '\n');
      return q === '"' ? unescapeDouble(inner, line.n) : inner.replace(/''/g, "'");
    }
    // plain scalar, possibly continued on more-indented lines
    let s = text;
    for (;;) {
      const next = this.lines[this.i];
      if (!next || next.text === '' || next.indent <= parentIndent || /^-( |$)/.test(next.text) || this.keyOf(next.text)) break;
      s += ` ${next.text}`;
      this.i++;
    }
    if (/:\s/.test(s) && !firstLineConsumed) {
      // "a: b: c" style mistakes
      throw new YamlError('A plain value cannot contain “: ” — wrap it in quotes.', line.n);
    }
    return resolveScalar(s.trim());
  }

  private blockScalar(header: string, line: Line, parentIndent: number): string {
    const m = /^([|>])([+-]?)(\d?)([+-]?)\s*$/.exec(header);
    if (!m) throw new YamlError(`Invalid block scalar header “${header}”.`, line.n);
    const folded = m[1] === '>';
    const chomp = m[2] || m[4];
    const explicit = m[3] ? Number(m[3]) : 0;
    const raw: string[] = [];
    let blockIndent = explicit ? parentIndent + explicit : -1;
    while (this.i < this.lines.length) {
      const l = this.lines[this.i];
      const content = l.raw;
      if (content.trim() === '') {
        raw.push('');
        this.i++;
        continue;
      }
      const ind = /^ */.exec(content)![0].length;
      if (blockIndent < 0) blockIndent = ind;
      if (ind < blockIndent || ind <= parentIndent) break;
      raw.push(content.slice(blockIndent));
      this.i++;
    }
    // trailing blank lines belong to chomping
    let trailing = 0;
    while (raw.length && raw[raw.length - 1] === '') {
      raw.pop();
      trailing++;
    }
    let body: string;
    if (!folded) body = raw.join('\n');
    else {
      body = '';
      raw.forEach((l, k) => {
        if (k === 0) body = l;
        else if (l === '') body += '\n';
        else if (raw[k - 1] === '') body += /^\s/.test(l) ? `\n${l}` : l;
        else if (/^\s/.test(l) || /^\s/.test(raw[k - 1])) body += `\n${l}`;
        else body += ` ${l}`;
      });
    }
    if (chomp === '-') return body;
    if (chomp === '+') return body + '\n'.repeat(trailing + 1);
    return raw.length ? `${body}\n` : '';
  }
}

function applyTag(tag: string, v: YamlValue, line: number): YamlValue {
  switch (tag) {
    case '!str':
      return v === null ? '' : typeof v === 'object' ? v : String(v);
    case '!int':
    case '!float': {
      const n = Number(v);
      if (Number.isNaN(n)) throw new YamlError(`“${String(v)}” is not a number.`, line);
      return n;
    }
    case '!bool':
      return v === true || v === 'true';
    case '!null':
      return null;
    case '!map':
    case '!seq':
    case '':
      return v;
    default:
      throw new YamlError(`The tag “!${tag}” is not supported.`, line);
  }
}

function closedQuote(s: string, q: string): number | null {
  for (let j = 1; j < s.length; j++) {
    if (q === '"' && s[j] === '\\') {
      j++;
      continue;
    }
    if (s[j] === q) {
      if (q === "'" && s[j + 1] === "'") {
        j++;
        continue;
      }
      return j;
    }
  }
  return null;
}

function balanced(s: string): boolean {
  let depth = 0;
  let q: string | null = null;
  for (let j = 0; j < s.length; j++) {
    const c = s[j];
    if (q) {
      if (c === '\\' && q === '"') j++;
      else if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
  }
  return depth <= 0 && !q;
}

class FlowParser {
  private j = 0;
  constructor(private s: string, private line: number, private anchors: Map<string, YamlValue>) {}

  parseAll(): YamlValue {
    const v = this.value();
    this.ws();
    if (this.j < this.s.length) throw new YamlError(`Unexpected “${this.s.slice(this.j, this.j + 20)}” after a flow collection.`, this.line);
    return v;
  }
  private ws() {
    while (this.j < this.s.length && /\s/.test(this.s[this.j])) this.j++;
  }
  private value(): YamlValue {
    this.ws();
    const c = this.s[this.j];
    if (c === '[') return this.seq();
    if (c === '{') return this.map();
    if (c === '"' || c === "'") return this.quoted();
    if (c === '*') {
      const m = /^\*([^\s,[\]{}]+)/.exec(this.s.slice(this.j))!;
      this.j += m[0].length;
      if (!this.anchors.has(m[1])) throw new YamlError(`Unknown alias “*${m[1]}”.`, this.line);
      return structuredClone(this.anchors.get(m[1])!);
    }
    const m = /^[^,[\]{}]*/.exec(this.s.slice(this.j))!;
    let text = m[0];
    // in a flow map, a plain key stops at ": "
    const colon = text.search(/:(\s|$)/);
    if (colon >= 0) text = text.slice(0, colon);
    this.j += text.length;
    return resolveScalar(text.trim());
  }
  private quoted(): string {
    const q = this.s[this.j];
    const end = closedQuote(this.s.slice(this.j), q);
    if (end === null) throw new YamlError('A quoted string inside […] or {…} is not closed.', this.line);
    const inner = this.s.slice(this.j + 1, this.j + end);
    this.j += end + 1;
    return q === '"' ? unescapeDouble(inner, this.line) : inner.replace(/''/g, "'");
  }
  private seq(): YamlValue[] {
    this.j++;
    const out: YamlValue[] = [];
    for (;;) {
      this.ws();
      if (this.s[this.j] === ']') {
        this.j++;
        return out;
      }
      out.push(this.value());
      this.ws();
      if (this.s[this.j] === ',') this.j++;
      else if (this.s[this.j] !== ']') throw new YamlError('Expected “,” or “]” in a flow list.', this.line);
    }
  }
  private map(): Record<string, YamlValue> {
    this.j++;
    const out: Record<string, YamlValue> = {};
    for (;;) {
      this.ws();
      if (this.s[this.j] === '}') {
        this.j++;
        return out;
      }
      const k = this.value();
      this.ws();
      let v: YamlValue = null;
      if (this.s[this.j] === ':') {
        this.j++;
        v = this.value();
      }
      out[String(k)] = v;
      this.ws();
      if (this.s[this.j] === ',') this.j++;
      else if (this.s[this.j] !== '}') throw new YamlError('Expected “,” or “}” in a flow map.', this.line);
    }
  }
}

/** Parses all documents in a YAML stream. */
export function parseYamlAll(src: string): YamlValue[] {
  const lines = src.replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n');
  const docs: Array<{ start: number; lines: string[] }> = [];
  let cur: { start: number; lines: string[] } = { start: 1, lines: [] };
  lines.forEach((l, k) => {
    if (/^%/.test(l) && !cur.lines.some((x) => x.trim())) return; // directives
    if (/^---(\s|$)/.test(l)) {
      if (cur.lines.some((x) => x.trim() && !/^\s*#/.test(x))) docs.push(cur);
      const rest = l.slice(3).trim();
      cur = { start: k + 1, lines: [rest ? rest : ''] };
      return;
    }
    if (/^\.\.\.(\s|$)/.test(l)) {
      docs.push(cur);
      cur = { start: k + 2, lines: [] };
      return;
    }
    cur.lines.push(l);
  });
  if (cur.lines.some((x) => x.trim() && !/^\s*#/.test(x)) || !docs.length) docs.push(cur);
  return docs.map((d) => new Parser(d.lines, d.start).parseDocument());
}

export function parseYaml(src: string): YamlValue {
  const docs = parseYamlAll(src);
  return docs.length === 1 ? docs[0] : docs;
}

/* ------------------------------------------------------------ writer */

const NEEDS_QUOTES = /^[\s]|[\s]$|^[-?:,[\]{}#&*!|>'"%@`]|: |\s#|^$/;

function scalar(v: YamlValue): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isNaN(v) ? '.nan' : v === Infinity ? '.inf' : v === -Infinity ? '-.inf' : String(v);
  const s = String(v);
  if (NEEDS_QUOTES.test(s) || resolveScalar(s) !== s || /[\u0000-\u001f\u007f]/.test(s)) return JSON.stringify(s);
  return s;
}

export function stringifyYaml(v: unknown, indent = 2): string {
  const pad = (n: number) => ' '.repeat(n);
  const out: string[] = [];
  const block = (s: string, level: number) => {
    const keep = s.endsWith('\n') ? (s.endsWith('\n\n') ? '+' : '') : '-';
    return `|${keep}\n${s.replace(/\n$/, '').split('\n').map((l) => (l ? pad(level) + l : '')).join('\n')}`;
  };
  const write = (val: unknown, level: number, prefix: string) => {
    if (Array.isArray(val)) {
      if (!val.length) return out.push(`${prefix}[]`);
      if (prefix) out.push(prefix.replace(/ $/, ''));
      for (const item of val) {
        if (item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length) {
          const keys = Object.keys(item as object);
          const firstLine = out.length;
          write(item, level + indent, '');
          out[firstLine] = `${pad(level)}- ${out[firstLine].slice(level + indent)}`;
          void keys;
        } else if (Array.isArray(item) && item.length) {
          const firstLine = out.length;
          write(item, level + indent, '');
          out[firstLine] = `${pad(level)}- ${out[firstLine].slice(level + indent)}`;
        } else write(item, level, `${pad(level)}- `);
      }
      return;
    }
    if (val && typeof val === 'object') {
      const entries = Object.entries(val as Record<string, unknown>);
      if (!entries.length) return out.push(`${prefix}{}`);
      if (prefix) out.push(prefix.replace(/ $/, ''));
      for (const [k, x] of entries) {
        const key = scalar(k);
        if (x && typeof x === 'object' && (Array.isArray(x) ? x.length : Object.keys(x).length)) write(x, Array.isArray(x) ? level : level + indent, `${pad(level)}${key}:`);
        else write(x, level + indent, `${pad(level)}${key}: `);
      }
      return;
    }
    if (typeof val === 'string' && val.includes('\n')) return out.push(`${prefix}${block(val, level)}`);
    if (val === undefined || typeof val === 'function') return out.push(`${prefix}null`);
    out.push(`${prefix}${scalar(val as YamlValue)}`);
  };
  write(v, 0, '');
  return out.join('\n') + '\n';
}
