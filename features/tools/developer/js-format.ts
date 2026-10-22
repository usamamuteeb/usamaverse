/**
 * JavaScript / TypeScript beautifier based on a tokenizer — the code is only
 * re-spaced as text, never parsed into a program or executed. It handles
 * strings, template literals (with ${…}), regex literals, comments, ASI-safe
 * line breaks and object/array literals. Output style: 2-space indent, braces
 * on the same line, one statement per line.
 */

type TokType = 'ws' | 'nl' | 'comment' | 'lcomment' | 'string' | 'template' | 'regex' | 'number' | 'word' | 'punct';
export interface Token {
  t: TokType;
  v: string;
}

const PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];
const REGEX_BEFORE_WORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = src.length;
  const lastSignificant = () => {
    for (let k = out.length - 1; k >= 0; k--) if (!['ws', 'nl', 'comment', 'lcomment'].includes(out[k].t)) return out[k];
    return undefined;
  };
  const regexAllowed = () => {
    const p = lastSignificant();
    if (!p) return true;
    if (p.t === 'word') return REGEX_BEFORE_WORDS.has(p.v);
    if (p.t === 'punct') return !/^[)\]}]$/.test(p.v) && p.v !== '++' && p.v !== '--';
    return false;
  };
  while (i < n) {
    const c = src[i];
    if (c === '\n') {
      out.push({ t: 'nl', v: '\n' });
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      let j = i;
      while (j < n && /\s/.test(src[j]) && src[j] !== '\n') j++;
      out.push({ t: 'ws', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      let j = src.indexOf('\n', i);
      if (j < 0) j = n;
      out.push({ t: 'lcomment', v: src.slice(i, j).replace(/\s+$/, '') });
      i = j;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2);
      j = j < 0 ? n : j + 2;
      out.push({ t: 'comment', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out.push({ t: 'string', v: src.slice(i, Math.min(j + 1, n)) });
      i = j + 1;
      continue;
    }
    if (c === '`') {
      // template literal with nested ${ … } (which may contain more templates)
      let j = i + 1;
      const stack: number[] = [];
      while (j < n) {
        const d = src[j];
        if (d === '\\') {
          j += 2;
          continue;
        }
        if (!stack.length && d === '`') break;
        if (d === '$' && src[j + 1] === '{') {
          stack.push(0);
          j += 2;
          continue;
        }
        if (stack.length) {
          if (d === '{') stack[stack.length - 1]++;
          else if (d === '}') {
            if (stack[stack.length - 1] === 0) stack.pop();
            else stack[stack.length - 1]--;
          } else if (d === '`') {
            // nested template inside ${}
            j++;
            while (j < n && src[j] !== '`') j += src[j] === '\\' ? 2 : 1;
          } else if (d === '"' || d === "'") {
            const q = d;
            j++;
            while (j < n && src[j] !== q) j += src[j] === '\\' ? 2 : 1;
          }
        }
        j++;
      }
      out.push({ t: 'template', v: src.slice(i, Math.min(j + 1, n)) });
      i = j + 1;
      continue;
    }
    if (c === '/' && regexAllowed()) {
      let j = i + 1;
      let cls = false;
      while (j < n && src[j] !== '\n') {
        const d = src[j];
        if (d === '\\') {
          j += 2;
          continue;
        }
        if (d === '[') cls = true;
        else if (d === ']') cls = false;
        else if (d === '/' && !cls) break;
        j++;
      }
      j++;
      while (j < n && /[a-z]/i.test(src[j])) j++;
      out.push({ t: 'regex', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(0[xob][0-9a-f_]+n?|(\d[\d_]*)?\.?\d[\d_]*(e[+-]?\d+)?n?)/i.exec(src.slice(i))!;
      out.push({ t: 'number', v: m[0] });
      i += m[0].length || 1;
      continue;
    }
    if (/[A-Za-z_$\u0080-￿#@]/.test(c)) {
      const m = /^[#@]?[A-Za-z0-9_$\u0080-￿]+/.exec(src.slice(i))!;
      out.push({ t: 'word', v: m[0] });
      i += m[0].length;
      continue;
    }
    const p = PUNCT.find((x) => src.startsWith(x, i)) ?? c;
    out.push({ t: 'punct', v: p });
    i += p.length;
  }
  return out;
}

const SPACE_AFTER_WORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'const', 'let', 'var', 'new', 'typeof', 'instanceof', 'in', 'of', 'case', 'throw', 'await', 'async', 'yield', 'delete', 'void', 'else', 'do', 'try', 'finally', 'export', 'import', 'from', 'as', 'extends', 'class', 'function', 'static', 'get', 'set', 'interface', 'type', 'implements', 'enum', 'declare', 'readonly', 'public', 'private', 'protected', 'abstract']);
const BINARY = new Set(['=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '+', '-', '*', '/', '%', '**', '&&', '||', '??', '&', '|', '^', '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '%=', '**=', '&=', '|=', '^=', '<<=', '>>=', '>>>=', '&&=', '||=', '??=', '=>', '?', ':']);

/** Index of the ">" (or ">>"/">>>" part) closing a TypeScript type-argument list that opens at `start`, or -1. */
function genericEnd(sig: Token[], start: number, opens: number[] = []): number {
  let depth = 0;
  let paren = 0;
  for (let b = start; b < Math.min(sig.length, start + 60); b++) {
    const x = sig[b];
    if (x.t === 'nl' || x.t === 'comment' || x.t === 'lcomment') continue;
    if (x.t === 'punct') {
      if (x.v === '<') {
        depth++;
        opens.push(b);
      } else if (/^>+$/.test(x.v)) {
        opens.push(b);
        depth -= x.v.length;
        if (depth <= 0) return depth === 0 ? b : -1;
      } else if (x.v === '(' || x.v === '[' || x.v === '{') paren++;
      else if (x.v === ')' || x.v === ']' || x.v === '}') {
        if (--paren < 0) return -1;
      } else if (!/^(\||&|,|\.|\?|:|=>|\.\.\.|;)$/.test(x.v) || (x.v === ';' && paren === 0)) return -1;
    } else if (x.t === 'regex' || x.t === 'template') return -1;
  }
  return -1;
}

export function formatJs(src: string, indentUnit = '  '): string {
  const toks = tokenize(src.replace(/\r\n?/g, '\n'));
  const sig = toks.filter((t) => t.t !== 'ws');
  const genericClose = new Set<number>();
  const genericOpen = new Set<number>();
  let out = '';
  let level = 0;
  const parens: number[] = []; // paren depth at each open brace; >0 means "inside ( )"
  let parenDepth = 0;
  const braceKinds: Array<'block' | 'object'> = [];
  const inlineBraces: boolean[] = []; // short { a, b } kept on one line
  const caseOpen: boolean[] = []; // inside a case body of this brace (one extra indent)
  let ternary = 0;
  let lineStart = true;
  const nl = () => {
    out = out.replace(/[ \t]+$/, '');
    if (!out.endsWith('\n') && out.length) out += '\n';
    lineStart = true;
  };
  const write = (s: string) => {
    if (lineStart) {
      out += indentUnit.repeat(Math.max(0, level));
      lineStart = false;
    }
    out += s;
  };
  const space = () => {
    if (!lineStart && !/[ \n(\[]$/.test(out)) out += ' ';
  };
  let prev: Token | undefined;
  let blankPending = false;
  let glue = false; // the next word is written without a leading space (after "(", ".", "!", unary "-", …)
  for (let k = 0; k < sig.length; k++) {
    const t = sig[k];
    const next = sig.slice(k + 1).find((x) => x.t !== 'nl');
    if (t.t === 'nl') {
      // keep one blank line where the author had blank lines between statements
      if (sig[k - 1]?.t === 'nl' && level >= 0) blankPending = true;
      // ASI: a newline after a value, before a word/string that starts a new statement, ends the statement
      const valueEnd = !!prev && (/^(word|number|string|template|regex)$/.test(prev.t) || (prev.t === 'punct' && /^([)\]}]|\+\+|--)$/.test(prev.v)));
      const startsStatement = !!next && (next.t === 'string' || next.t === 'template' || (next.t === 'word' && !/^(else|catch|finally|while|in|of|instanceof|as|extends|implements)$/.test(next.v)));
      const keywordOnly = prev?.t === 'word' && /^(const|let|var|new|typeof|await|async|export|import|function|class|extends|static|get|set|type|interface)$/.test(prev.v);
      if (!lineStart && parenDepth === 0 && valueEnd && startsStatement && !keywordOnly && braceKinds[braceKinds.length - 1] !== 'object') nl();
      continue;
    }
    if (blankPending && lineStart && out.length && t.v !== '}') {
      out += '\n';
    }
    blankPending = false;
    const v = t.v;
    if (t.t === 'lcomment') {
      // a comment that followed code on the same line stays on that line
      if (lineStart && k > 0 && sig[k - 1].t !== 'nl' && out.endsWith('\n')) {
        out = out.slice(0, -1);
        lineStart = false;
      }
      if (!lineStart) space();
      write(v);
      nl();
      prev = t;
      continue;
    }
    if (t.t === 'comment') {
      if (!lineStart) space();
      write(v.split('\n').map((l, i) => (i ? l.trim().replace(/^\*/, ' *') : l)).join(`\n${indentUnit.repeat(level)}`));
      if (sig[k + 1]?.t === 'nl' || v.startsWith('/**')) nl();
      prev = t;
      continue;
    }
    if (t.t === 'punct') {
      glue = /^(\(|\[|\.|\?\.|!|~|\.\.\.)$/.test(v);
      switch (v) {
        case '{': {
          const isObject = !!prev && ((prev.t === 'punct' && /^(=|\(|,|:|\[|\?|\|\||&&|\?\?|\.\.\.)$/.test(prev.v)) || (prev.t === 'word' && /^(return|of|in)$/.test(prev.v)));
          const kind = isObject ? 'object' : 'block';
          // empty braces stay together
          if (next && next.v === '}') {
            space();
            write('{}');
            k = sig.indexOf(next, k + 1);
            prev = next;
            continue;
          }
          if (prev && !(prev.t === 'punct' && /^[([{]$/.test(prev.v)) && !(kind === 'object' && prev.v === '(')) space();
          // short, flat braces (imports, small objects) stay on one line
          let inline = false;
          if (kind === 'object' || (prev?.t === 'word' && /^(import|export|type)$/.test(prev.v))) {
            let width = 0;
            inline = true;
            for (let b = k + 1; b < sig.length; b++) {
              const x = sig[b];
              if (x.t === 'punct' && x.v === '}') break;
              if ((x.t === 'punct' && /^[{;]$/.test(x.v)) || x.t === 'comment' || x.t === 'lcomment' || x.t === 'template' || (x.t === 'word' && x.v === 'function')) {
                inline = false;
                break;
              }
              width += x.v.length + 1;
              if (width > 56) {
                inline = false;
                break;
              }
            }
          }
          write(inline ? '{ ' : '{');
          braceKinds.push(kind);
          inlineBraces.push(inline);
          caseOpen.push(false);
          parens.push(parenDepth);
          parenDepth = inline ? 1 : 0;
          if (!inline) {
            level++;
            nl();
          }
          break;
        }
        case '}': {
          const wasInline = inlineBraces.pop();
          if (caseOpen.pop()) level--;
          if (wasInline) {
            out = out.replace(/[ ,]+$/, '');
            write(' }');
          } else {
            level--;
            nl();
            write('}');
          }
          braceKinds.pop();
          parenDepth = parens.pop() ?? 0;
          if (next && !(next.t === 'punct' && next.v === '(') && !(next.t === 'punct' && /^[),;\]\.]$|^\?\.$/.test(next.v)) && !(next.t === 'word' && /^(else|catch|finally|while|from|as)$/.test(next.v)) && !(next.t === 'punct' && (next.v === ':' || next.v === '?' || BINARY.has(next.v)))) nl();
          break;
        }
        case '(':
        case '[':
          if (prev && ((prev.t === 'word' && SPACE_AFTER_WORDS.has(prev.v) && !/^(function|super|import)$/.test(prev.v)) || (prev.t === 'punct' && BINARY.has(prev.v) && !out.endsWith('>')) || (prev.t === 'punct' && prev.v === ','))) space();
          write(v);
          parenDepth++;
          break;
        case ')':
        case ']':
          out = out.replace(/[ \n]+$/, (m) => (m.includes('\n') ? m : ''));
          write(v);
          parenDepth = Math.max(0, parenDepth - 1);
          break;
        case ';':
          out = out.replace(/ +$/, '');
          write(';');
          if (parenDepth > 0) out += ' ';
          else nl();
          break;
        case ',':
          out = out.replace(/ +$/, '');
          write(',');
          if (parenDepth === 0 && braceKinds[braceKinds.length - 1] === 'object') nl();
          else out += ' ';
          break;
        case '.':
        case '?.':
          out = out.replace(/ +$/, '');
          write(v);
          break;
        case '...':
          if (prev && prev.v !== '(' && prev.v !== '[' && prev.v !== '{') space();
          write(v);
          break;
        case '!':
        case '~':
          if (prev && !(prev.t === 'punct' && /^[([{!~]$/.test(prev.v))) space();
          write(v);
          break;
        case '++':
        case '--': {
          const postfix = prev && (prev.t === 'word' || prev.t === 'number' || (prev.t === 'punct' && /^[)\]]$/.test(prev.v)));
          if (!postfix) {
            space();
            glue = true;
          }
          write(v);
          break;
        }
        case '?':
          ternary++;
          space();
          write('?');
          out += ' ';
          break;
        case ':': {
          const inObject = braceKinds[braceKinds.length - 1] === 'object' && parenDepth === 0 && ternary === 0;
          let isCase = false;
          for (let b = k - 1; b >= 0; b--) {
            const x = sig[b];
            if (x.t === 'punct' && /^[;{}:]$/.test(x.v)) break;
            if (x.t === 'word' && /^(case|default)$/.test(x.v)) {
              isCase = !inObject;
              break;
            }
          }
          if (ternary > 0) {
            ternary--;
            space();
            write(':');
            out += ' ';
          } else if (isCase && braceKinds[braceKinds.length - 1] === 'block' && parenDepth === 0) {
            out = out.replace(/ +$/, '');
            write(':');
            if (!caseOpen[caseOpen.length - 1]) {
              caseOpen[caseOpen.length - 1] = true;
              level++;
            }
            nl();
          } else {
            out = out.replace(/ +$/, '');
            write(':');
            out += ' ';
          }
          break;
        }
        default: {
          if (v === '<' && prev && (genericOpen.has(k) || prev.t === 'word' || prev.v === '.')) {
            const opens: number[] = [];
            const end = genericOpen.has(k) ? k : genericEnd(sig, k, opens);
            if (end > 0) {
              if (end !== k) genericClose.add(end);
              for (const o of opens) {
                genericOpen.add(o);
                genericClose.add(o);
              }
              out = out.replace(/ +$/, '');
              write('<');
              glue = true;
              break;
            }
          }
          if (/^>+$/.test(v) && genericClose.has(k)) {
            out = out.replace(/ +$/, '');
            write(v);
            break;
          }
          const unary = (v === '-' || v === '+') && (!prev || (prev.t === 'punct' && !/^[)\]}]$/.test(prev.v)) || (prev.t === 'word' && REGEX_BEFORE_WORDS.has(prev.v)));
          if (unary) {
            space();
            write(v);
            glue = true;
          } else if (BINARY.has(v) || v === '<' || v === '>') {
            space();
            write(v);
            out += ' ';
          } else write(v);
        }
      }
      prev = t;
      continue;
    }
    // words, numbers, strings, templates, regex
    if (prev && !glue) space();
    glue = false;
    if (t.t === 'word' && /^(case|default)$/.test(t.v) && !(prev?.t === 'word' && prev.v === 'export') && sig[k + 1]?.v !== '(') {
      if (!lineStart) nl();
      if (caseOpen[caseOpen.length - 1]) {
        caseOpen[caseOpen.length - 1] = false;
        level--;
      }
    }
    write(v);
    prev = t;
  }
  return out.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** Removes comments and blank lines, collapses indentation; keeps line breaks so ASI stays safe. */
export function compactJs(src: string): string {
  const toks = tokenize(src.replace(/\r\n?/g, '\n'));
  let out = '';
  let prev: Token | undefined;
  for (const t of toks) {
    if (t.t === 'comment' || t.t === 'lcomment') {
      if (t.v.startsWith('/*!')) out += t.v;
      continue;
    }
    if (t.t === 'ws') continue;
    if (t.t === 'nl') {
      if (!out.endsWith('\n') && out.length) out += '\n';
      continue;
    }
    if (prev && prev.t !== 'nl' && /[A-Za-z0-9_$]$/.test(out) && /^[A-Za-z0-9_$]/.test(t.v)) out += ' ';
    else if (prev && /[+-]$/.test(out) && /^[+-]/.test(t.v)) out += ' ';
    out += t.v;
    prev = t;
  }
  return out.replace(/\n+/g, '\n').trim() + '\n';
}
