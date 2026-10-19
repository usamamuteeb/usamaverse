/**
 * Code formatters that only transform text. Nothing here parses into a live DOM
 * or executes code: HTML, CSS and SQL are tokenized as strings.
 */

// ---------------------------------------------------------------- HTML

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param', 'keygen']);
const RAW = new Set(['script', 'style', 'pre', 'textarea', 'title']);
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'img', 'kbd', 'label', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'input', 'button', 'select', 'output']);

type HNode =
  | { t: 'el'; name: string; open: string; children: HNode[]; selfClosed: boolean }
  | { t: 'text'; text: string }
  | { t: 'raw'; text: string }; // comments, doctype, raw element bodies

function tagName(open: string): string {
  return (open.match(/^<\/?\s*([a-zA-Z][\w:-]*)/)?.[1] ?? '').toLowerCase();
}

function readTagEnd(src: string, i: number): number {
  let q: string | null = null;
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (q) {
      if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === '>') return j + 1;
  }
  return src.length;
}

export function parseHtml(src: string): HNode[] {
  const root: HNode[] = [];
  const stack: Array<Extract<HNode, { t: 'el' }>> = [];
  const push = (n: HNode) => (stack.length ? stack[stack.length - 1].children : root).push(n);
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      const j = end === -1 ? src.length : end + 3;
      push({ t: 'raw', text: src.slice(i, j) });
      i = j;
    } else if (src.startsWith('<!', i) || src.startsWith('<?', i)) {
      const j = readTagEnd(src, i);
      push({ t: 'raw', text: src.slice(i, j) });
      i = j;
    } else if (src.startsWith('</', i) && /[a-zA-Z]/.test(src[i + 2] ?? '')) {
      const j = readTagEnd(src, i);
      const name = tagName(src.slice(i, j));
      // Close up to the matching element (tolerates missing closing tags like </p>).
      const idx = stack.map((e) => e.name).lastIndexOf(name);
      if (idx !== -1) stack.length = idx;
      i = j;
    } else if (src[i] === '<' && /[a-zA-Z]/.test(src[i + 1] ?? '')) {
      const j = readTagEnd(src, i);
      const open = src.slice(i, j);
      const name = tagName(open);
      const selfClosed = /\/\s*>$/.test(open) || VOID.has(name);
      const el: Extract<HNode, { t: 'el' }> = { t: 'el', name, open, children: [], selfClosed };
      push(el);
      i = j;
      if (selfClosed) continue;
      if (RAW.has(name)) {
        const close = src.toLowerCase().indexOf(`</${name}`, i);
        const end = close === -1 ? src.length : close;
        if (end > i) el.children.push({ t: 'raw', text: src.slice(i, end) });
        i = close === -1 ? src.length : readTagEnd(src, close);
        continue;
      }
      stack.push(el);
    } else {
      const next = src.indexOf('<', i + 1);
      const j = next === -1 ? src.length : next;
      push({ t: 'text', text: src.slice(i, j) });
      i = j;
    }
  }
  return root;
}

function isInlineNode(n: HNode): boolean {
  return n.t === 'text' || (n.t === 'el' && INLINE.has(n.name) && n.children.every(isInlineNode));
}

function inlineHtml(n: HNode): string {
  if (n.t === 'text') return n.text.replace(/\s+/g, ' ');
  if (n.t === 'raw') return n.text;
  if (n.selfClosed) return n.open;
  return n.open + n.children.map(inlineHtml).join('') + `</${n.name}>`;
}

export function formatHtml(src: string, indentUnit = '  '): string {
  const out: string[] = [];
  const walk = (nodes: HNode[], depth: number) => {
    const pad = indentUnit.repeat(depth);
    let run: HNode[] = [];
    const flush = () => {
      const text = run.map(inlineHtml).join('').replace(/\s+/g, ' ').trim();
      if (text) out.push(pad + text);
      run = [];
    };
    for (const n of nodes) {
      if (isInlineNode(n)) {
        run.push(n);
        continue;
      }
      flush();
      if (n.t === 'raw') out.push(pad + n.text.trim());
      else if (n.t === 'el') {
        if (n.selfClosed) out.push(pad + n.open);
        else if (RAW.has(n.name)) {
          const body = n.children.map((c) => (c.t === 'raw' ? c.text : '')).join('');
          if (n.name === 'pre' || n.name === 'textarea' || !body.includes('\n')) out.push(`${pad}${n.open}${body}</${n.name}>`);
          else {
            out.push(pad + n.open);
            const lines = body.replace(/^\n+|\s+$/g, '').split('\n');
            const minIndent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length));
            lines.forEach((l) => out.push(l.trim() ? pad + indentUnit + l.slice(minIndent) : ''));
            out.push(`${pad}</${n.name}>`);
          }
        } else if (n.children.every(isInlineNode)) {
          const inner = n.children.map(inlineHtml).join('').replace(/\s+/g, ' ').trim();
          const line = `${pad}${n.open}${inner}</${n.name}>`;
          if (line.length <= 120 || !inner) out.push(line);
          else {
            out.push(pad + n.open);
            out.push(pad + indentUnit + inner);
            out.push(`${pad}</${n.name}>`);
          }
        } else {
          out.push(pad + n.open);
          walk(n.children, depth + 1);
          out.push(`${pad}</${n.name}>`);
        }
      }
    }
    flush();
  };
  walk(parseHtml(src.replace(/\r\n?/g, '\n')), 0);
  return out.join('\n');
}

export function minifyHtml(src: string): string {
  const serialize = (nodes: HNode[]): string =>
    nodes
      .map((n) => {
        if (n.t === 'text') return n.text.replace(/\s+/g, ' ');
        if (n.t === 'raw') return n.text.startsWith('<!--') && !n.text.startsWith('<!--[if') ? '' : n.text;
        if (n.selfClosed) return n.open;
        if (RAW.has(n.name)) return n.open + n.children.map((c) => (c.t === 'raw' ? c.text : '')).join('') + `</${n.name}>`;
        return n.open + serialize(n.children) + `</${n.name}>`;
      })
      .join('');
  return serialize(parseHtml(src))
    .replace(/>\s+</g, '> <')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------- CSS

type CssNode = { kind: 'decl'; text: string } | { kind: 'rule'; prelude: string; body: CssNode[] } | { kind: 'comment'; text: string } | { kind: 'stmt'; text: string };

function parseCssBlock(src: string, pos: { i: number }, nested: boolean): CssNode[] {
  const nodes: CssNode[] = [];
  let buf = '';
  let paren = 0;
  while (pos.i < src.length) {
    const c = src[pos.i];
    if (c === '/' && src[pos.i + 1] === '*') {
      const end = src.indexOf('*/', pos.i + 2);
      const j = end === -1 ? src.length : end + 2;
      if (buf.trim()) buf += ' ';
      else nodes.push({ kind: 'comment', text: src.slice(pos.i, j) });
      pos.i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = pos.i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      buf += src.slice(pos.i, j + 1);
      pos.i = j + 1;
      continue;
    }
    if (c === '(') paren++;
    if (c === ')') paren = Math.max(0, paren - 1);
    if (paren === 0 && c === '{') {
      pos.i++;
      nodes.push({ kind: 'rule', prelude: buf.trim(), body: parseCssBlock(src, pos, true) });
      buf = '';
      continue;
    }
    if (paren === 0 && c === '}') {
      pos.i++;
      if (buf.trim()) nodes.push({ kind: 'decl', text: buf.trim() });
      if (!nested) throw new Error('Unexpected “}” — a block was closed that was never opened.');
      return nodes;
    }
    if (paren === 0 && c === ';') {
      pos.i++;
      if (buf.trim()) nodes.push(nested ? { kind: 'decl', text: buf.trim() } : { kind: 'stmt', text: buf.trim() });
      buf = '';
      continue;
    }
    buf += c;
    pos.i++;
  }
  if (nested) throw new Error('A “{” block is never closed.');
  if (buf.trim()) nodes.push({ kind: 'stmt', text: buf.trim() });
  return nodes;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

function normDecl(text: string, min: boolean): string {
  const i = text.indexOf(':');
  if (i === -1) return collapse(text);
  const prop = text.slice(0, i).trim();
  let value = collapse(text.slice(i + 1));
  if (min) value = value.replace(/\s*,\s*/g, ',').replace(/\s*!\s*important/i, '!important');
  return min ? `${prop}:${value}` : `${prop}: ${value}`;
}

function normPrelude(p: string, min: boolean): string {
  const s = collapse(p);
  return min ? s.replace(/\s*([,>~])\s*/g, '$1') : s.replace(/\s*,\s*/g, ', ');
}

export function parseCss(src: string): CssNode[] {
  return parseCssBlock(src.replace(/\r\n?/g, '\n'), { i: 0 }, false);
}

export function formatCss(src: string, indentUnit = '  '): string {
  const out: string[] = [];
  const walk = (nodes: CssNode[], depth: number) => {
    const pad = indentUnit.repeat(depth);
    nodes.forEach((n, idx) => {
      if (n.kind === 'comment') out.push(pad + n.text);
      else if (n.kind === 'decl') out.push(`${pad}${normDecl(n.text, false)};`);
      else if (n.kind === 'stmt') out.push(`${pad}${collapse(n.text)};`);
      else {
        const sel = normPrelude(n.prelude, false);
        const selector = sel.includes(', ') && !sel.startsWith('@') ? sel.split(', ').join(`,\n${pad}`) : sel;
        out.push(`${pad}${selector} {`);
        walk(n.body, depth + 1);
        out.push(`${pad}}`);
        if (depth === 0 && idx < nodes.length - 1) out.push('');
      }
    });
  };
  walk(parseCss(src), 0);
  return out.join('\n');
}

export function minifyCss(src: string): string {
  const keep = (n: CssNode) => n.kind !== 'comment' || n.text.startsWith('/*!');
  const one = (n: CssNode): string => {
    if (n.kind === 'comment') return n.text;
    if (n.kind === 'stmt') return `${collapse(n.text)};`;
    if (n.kind === 'decl') return normDecl(n.text, true);
    return `${normPrelude(n.prelude, true)}{${body(n.body)}}`;
  };
  // Inside a block: semicolons only between a declaration and whatever follows it.
  const body = (nodes: CssNode[]) => {
    const list = nodes.filter(keep);
    return list.map((n, i) => one(n) + (n.kind === 'decl' && i < list.length - 1 ? ';' : '')).join('');
  };
  return parseCss(src).filter(keep).map(one).join('');
}

// ---------------------------------------------------------------- SQL

const SQL_KEYWORDS = new Set(
  ('select from where and or not in is null like between exists group by order having limit offset join inner left right full outer cross on as ' +
    'union all distinct insert into values update set delete create table alter drop index view with case when then else end asc desc ' +
    'primary key foreign references default unique check returning using natural top fetch next rows only over partition window cast ' +
    'count sum avg min max coalesce nullif true false interval if replace truncate grant revoke begin commit rollback').split(' '),
);

const FUNC_KEYWORDS = new Set(['count', 'sum', 'avg', 'min', 'max', 'coalesce', 'nullif', 'cast', 'replace', 'if', 'exists']);

const BREAK_BEFORE = ['select', 'from', 'where', 'group by', 'order by', 'having', 'limit', 'offset', 'union all', 'union', 'insert into', 'values', 'update', 'set', 'delete from', 'returning', 'with', 'left outer join', 'right outer join', 'full outer join', 'left join', 'right join', 'inner join', 'full join', 'cross join', 'join', 'window'];

type SqlTok = { k: 'word' | 'str' | 'ident' | 'num' | 'op' | 'comment' | 'ws'; v: string };

export function tokenizeSql(src: string): SqlTok[] {
  const toks: SqlTok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\s+/))) toks.push({ k: 'ws', v: m[0] });
    else if ((m = rest.match(/^--[^\n]*/))) toks.push({ k: 'comment', v: m[0] });
    else if (rest.startsWith('/*')) {
      const end = src.indexOf('*/', i + 2);
      toks.push({ k: 'comment', v: src.slice(i, end === -1 ? src.length : end + 2) });
    } else if (c === "'" || c === '"' || c === '`' || c === '[') {
      const close = c === '[' ? ']' : c;
      let j = i + 1;
      for (; j < src.length; j++) {
        if (src[j] === close) {
          if (close !== ']' && src[j + 1] === close) {
            j++;
            continue;
          }
          break;
        }
      }
      toks.push({ k: c === "'" ? 'str' : 'ident', v: src.slice(i, j + 1) });
    } else if ((m = rest.match(/^\d+(\.\d+)?(e[+-]?\d+)?/i))) toks.push({ k: 'num', v: m[0] });
    else if ((m = rest.match(/^[\p{L}_@#$][\p{L}\p{N}_$#.]*/u))) toks.push({ k: 'word', v: m[0] });
    else if ((m = rest.match(/^(<>|<=|>=|!=|\|\||::|[-+*/%=<>(),;.])/))) toks.push({ k: 'op', v: m[0] });
    else toks.push({ k: 'op', v: c });
    i += toks[toks.length - 1].v.length;
  }
  return toks;
}

export function formatSql(src: string, o: { uppercase: boolean; indent: string }): string {
  const toks = tokenizeSql(src).filter((t) => t.k !== 'ws');
  const lines: string[] = [];
  let line = '';
  let depth = 0;
  const parenStack: boolean[] = []; // true = subquery paren (indented block)
  const pad = () => o.indent.repeat(depth);
  const newline = (extra = 0) => {
    if (line.trim()) lines.push(line.replace(/\s+$/, ''));
    line = o.indent.repeat(depth + extra);
  };
  const kw = (w: string) => (o.uppercase ? w.toUpperCase() : w.toLowerCase());
  let clause = '';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.k === 'comment') {
      if (t.v.startsWith('--')) {
        line += (line.trim() ? ' ' : '') + t.v;
        newline();
      } else line += (line.trim() ? ' ' : '') + t.v;
      continue;
    }
    if (t.k === 'word') {
      const lower = t.v.toLowerCase();
      // Multi-word clause starts
      const two = [lower, toks[i + 1]?.v.toLowerCase(), toks[i + 2]?.v.toLowerCase()];
      const match = BREAK_BEFORE.find((b) => {
        const parts = b.split(' ');
        return parts.every((p, k) => two[k] === p);
      });
      if (match) {
        const n = match.split(' ').length;
        newline();
        line = pad() + kw(match);
        clause = match.split(' ').pop()!;
        i += n - 1;
        if (['select', 'set', 'values', 'group by', 'order by'].some((c) => match.endsWith(c))) {
          lines.push(line);
          line = pad() + o.indent;
        } else line += ' ';
        continue;
      }
      if ((lower === 'and' || lower === 'or') && (clause === 'where' || clause === 'having' || clause === 'on')) {
        newline(1);
        line += kw(lower) + ' ';
        continue;
      }
      if (lower === 'on' && /join$/.test(clause)) {
        newline(1);
        line += kw('on') + ' ';
        clause = 'on';
        continue;
      }
      line += (SQL_KEYWORDS.has(lower) ? kw(t.v) : t.v) + ' ';
      continue;
    }
    if (t.v === '(') {
      const isSub = toks[i + 1]?.k === 'word' && ['select', 'with'].includes(toks[i + 1].v.toLowerCase());
      parenStack.push(isSub);
      if (isSub) {
        line += '(';
        depth++;
        newline();
      } else {
        const prev = toks[i - 1];
        const fnLike = prev && prev.k === 'word' && (!SQL_KEYWORDS.has(prev.v.toLowerCase()) || FUNC_KEYWORDS.has(prev.v.toLowerCase()));
        line = (fnLike ? line.replace(/\s+$/, '') : line) + '(';
      }
      continue;
    }
    if (t.v === ')') {
      const isSub = parenStack.pop();
      if (isSub) {
        depth = Math.max(0, depth - 1);
        newline();
        line += ') ';
      } else line = line.replace(/\s+$/, '') + ') ';
      continue;
    }
    if (t.v === ',') {
      line = line.replace(/\s+$/, '') + ',';
      if (parenStack.length === 0 || parenStack[parenStack.length - 1]) {
        if (['select', 'by', 'set'].includes(clause)) {
          lines.push(line);
          line = pad() + o.indent;
          continue;
        }
      }
      line += ' ';
      continue;
    }
    if (t.v === ';') {
      line = line.replace(/\s+$/, '') + ';';
      newline();
      lines.push('');
      clause = '';
      continue;
    }
    if (t.v === '.' || t.v === '::') {
      line = line.replace(/\s+$/, '') + t.v;
      continue;
    }
    line += t.v + ' ';
  }
  newline();
  return lines
    .join('\n')
    .replace(/\(\s+\)/g, '()')
    .replace(/\.\s+/g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
