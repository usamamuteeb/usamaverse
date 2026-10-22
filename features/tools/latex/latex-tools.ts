/**
 * Markdown → LaTeX, table → LaTeX and LaTeX word counting. Pure functions,
 * all output escaped so the generated source always compiles as text.
 */
import { latexEscape, latexUrl } from './escape';
import { latexToMarkdownDoc } from './latex-parse';

/* ---------------------------------------------------------------- inline */

const INLINE = /(`+)([\s\S]*?[^`])\1(?!`)|\$(?!\$)((?:\\.|[^$\\])+?)\$|!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<((?:https?|mailto):[^>\s]+)>|(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\9|~~(?=\S)([\s\S]+?)(?<=\S)~~|(?<![\w*])\*(?=[^\s*])([\s\S]+?)(?<=[^\s*])\*(?!\*)|(?<![\w_])_(?=[^\s_])([\s\S]+?)(?<=[^\s_])_(?![\w_])/g;

export function inlineToLatex(s: string): string {
  let out = '';
  let last = 0;
  const re = new RegExp(INLINE.source, 'g'); // a fresh regex: this function recurses
  for (let m = re.exec(s); m; m = re.exec(s)) {
    out += latexEscape(s.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[2] !== undefined) out += `\\texttt{${latexEscape(m[2].trim())}}`;
    else if (m[3] !== undefined) out += `$${m[3]}$`;
    else if (m[5] !== undefined) out += `\\includegraphics[width=\\linewidth]{${m[5].replace(/[{}\\%#]/g, '')}}`;
    else if (m[7] !== undefined) out += `\\href{${latexUrl(m[7])}}{${inlineToLatex(m[6])}}`;
    else if (m[8] !== undefined) out += `\\url{${latexUrl(m[8])}}`;
    else if (m[10] !== undefined) out += `\\textbf{${inlineToLatex(m[10])}}`;
    else if (m[11] !== undefined) out += `\\sout{${inlineToLatex(m[11])}}`;
    else if (m[12] !== undefined) out += `\\emph{${inlineToLatex(m[12])}}`;
    else if (m[13] !== undefined) out += `\\emph{${inlineToLatex(m[13])}}`;
  }
  out += latexEscape(s.slice(last));
  // two trailing spaces = hard line break
  return out.replace(/ {2,}\n/g, '\\\\\n');
}

/* ---------------------------------------------------------------- blocks */

export interface MdToLatexOptions {
  fullDocument: boolean;
  docClass: 'article' | 'report';
  titleFromH1: boolean;
  tables: 'booktabs' | 'grid';
  code: 'verbatim' | 'lstlisting';
}

export const defaultMdOptions: MdToLatexOptions = { fullDocument: true, docClass: 'article', titleFromH1: true, tables: 'booktabs', code: 'verbatim' };

const HEADS = { article: ['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph', 'subparagraph'], report: ['chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'] };

function splitRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && t[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (t[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += t[i];
  }
  cells.push(cur.trim());
  return cells;
}

const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

export function markdownToLatex(md: string, o: MdToLatexOptions = defaultMdOptions): { latex: string; warnings: string[] } {
  const lines = md.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const out: string[] = [];
  const warnings: string[] = [];
  const heads = HEADS[o.docClass];
  let title = '';
  let i = 0;
  let usedImages = false;
  let usedCode = false;

  type ListFrame = { indent: number; env: 'itemize' | 'enumerate' };
  const stack: ListFrame[] = [];
  const closeLists = (toIndent = -1) => {
    while (stack.length && stack[stack.length - 1].indent > toIndent) out.push(`${'  '.repeat(stack.length - 1)}\\end{${stack.pop()!.env}}`);
  };

  while (i < lines.length) {
    const line = lines[i];
    // fenced code
    const fence = /^\s*(```+|~~~+)\s*([\w+-]*)/.exec(line);
    if (fence) {
      closeLists();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      usedCode = true;
      if (o.code === 'lstlisting') out.push(`\\begin{lstlisting}${fence[2] ? `[language=${fence[2]}]` : ''}`, ...body, '\\end{lstlisting}', '');
      else out.push('\\begin{verbatim}', ...body, '\\end{verbatim}', '');
      if (body.some((b) => b.includes('\\end{verbatim}') || b.includes('\\end{lstlisting}'))) warnings.push('A code block contains an \\end{…} line that will end it early.');
      continue;
    }
    // display math
    if (/^\s*\$\$/.test(line)) {
      closeLists();
      let body = line.trim().replace(/^\$\$/, '');
      if (body.endsWith('$$') && body.length > 2) {
        out.push(`\\[ ${body.slice(0, -2).trim()} \\]`, '');
        i++;
        continue;
      }
      const parts = [body];
      i++;
      while (i < lines.length && !lines[i].includes('$$')) parts.push(lines[i++]);
      if (i < lines.length) parts.push(lines[i++].replace('$$', ''));
      body = parts.join('\n').trim();
      out.push('\\[', body, '\\]', '');
      continue;
    }
    // headings
    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      closeLists();
      const level = h[1].length;
      if (level === 1 && o.titleFromH1 && !title && o.fullDocument) title = h[2];
      else out.push(`\\${heads[Math.min(level - (o.titleFromH1 && o.fullDocument ? 2 : 1), 5)] ?? heads[0]}{${inlineToLatex(h[2])}}`, '');
      i++;
      continue;
    }
    // horizontal rule
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      closeLists();
      out.push('\\noindent\\rule{\\linewidth}{0.4pt}', '');
      i++;
      continue;
    }
    // table
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('|')) {
      closeLists();
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'c' : c.endsWith(':') ? 'r' : 'l'));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
      const n = Math.max(head.length, ...rows.map((r) => r.length));
      const cols = Array.from({ length: n }, (_, k) => aligns[k] ?? 'l');
      out.push(...tableLines([head, ...rows].map((r) => Array.from({ length: n }, (_, k) => inlineToLatex(r[k] ?? ''))), { header: true, aligns: cols, style: o.tables, escaped: true }), '');
      continue;
    }
    // blockquote
    if (/^\s{0,3}>/.test(line)) {
      closeLists();
      const body: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) body.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      const inner = markdownToLatex(body.join('\n'), { ...o, fullDocument: false, titleFromH1: false }).latex.trim();
      out.push('\\begin{quote}', inner, '\\end{quote}', '');
      continue;
    }
    // list item
    const li = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/.exec(line);
    if (li) {
      const indent = li[1].length;
      const env = /\d/.test(li[2]) ? 'enumerate' : 'itemize';
      while (stack.length && stack[stack.length - 1].indent > indent) out.push(`${'  '.repeat(stack.length - 1)}\\end{${stack.pop()!.env}}`);
      if (!stack.length || stack[stack.length - 1].indent < indent) {
        stack.push({ indent, env });
        out.push(`${'  '.repeat(stack.length - 1)}\\begin{${env}}`);
      } else if (stack[stack.length - 1].env !== env) {
        out.push(`${'  '.repeat(stack.length - 1)}\\end{${stack.pop()!.env}}`);
        stack.push({ indent, env });
        out.push(`${'  '.repeat(stack.length - 1)}\\begin{${env}}`);
      }
      let text = li[3];
      // continuation lines (indented, not a new item)
      while (i + 1 < lines.length && lines[i + 1].trim() && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*([-*+]|\d{1,9}[.)])\s+/.test(lines[i + 1])) text += ` ${lines[++i].trim()}`;
      const task = /^\[([ xX])\]\s+(.*)$/.exec(text);
      const pad = '  '.repeat(stack.length);
      if (task) out.push(`${pad}\\item[${task[1].trim() ? '$\\boxtimes$' : '$\\square$'}] ${inlineToLatex(task[2])}`);
      else out.push(`${pad}\\item ${inlineToLatex(text)}`);
      i++;
      continue;
    }
    if (!line.trim()) {
      // a blank line inside a list keeps the list open if the next line continues it
      const next = lines.slice(i + 1).find((l) => l.trim());
      if (!(stack.length && next && /^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(next))) closeLists();
      if (out.length && out[out.length - 1] !== '') out.push('');
      i++;
      continue;
    }
    // image alone on a line → figure
    const img = /^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/.exec(line);
    if (img) {
      closeLists();
      usedImages = true;
      out.push('\\begin{figure}[htbp]', '  \\centering', `  \\includegraphics[width=0.8\\linewidth]{${img[2].replace(/[{}\\%#]/g, '')}}`);
      if (img[1].trim()) out.push(`  \\caption{${inlineToLatex(img[1])}}`);
      out.push('\\end{figure}', '');
      i++;
      continue;
    }
    // paragraph
    closeLists();
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s{0,3}(#{1,6}\s|>|```|~~~|\$\$)/.test(lines[i]) && !/^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('|'))) para.push(lines[i++]);
    out.push(inlineToLatex(para.join('\n')), '');
  }
  closeLists();
  const body = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (usedImages) warnings.push('Images are referenced by file name — upload the image files next to the .tex file.');
  if (!o.fullDocument) return { latex: body + '\n', warnings };
  const pkgs = [
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T1]{fontenc}',
    '\\IfFileExists{lmodern.sty}{\\usepackage{lmodern}}{}',
    '\\usepackage[margin=2.5cm]{geometry}',
    '\\usepackage{amsmath,amssymb}',
    '\\usepackage{graphicx}',
    o.tables === 'booktabs' ? '\\usepackage{booktabs}' : '',
    /~~\S/.test(md) ? '\\usepackage[normalem]{ulem}' : '',
    o.code === 'lstlisting' && usedCode ? '\\usepackage{listings}\n\\lstset{basicstyle=\\ttfamily\\small, breaklines=true, frame=single}' : '',
    '\\usepackage[hidelinks]{hyperref}',
  ].filter(Boolean);
  const head = [`\\documentclass[11pt]{${o.docClass}}`, ...pkgs, ''];
  if (title) head.push(`\\title{${inlineToLatex(title)}}`, '\\author{}', '\\date{}', '');
  return { latex: `${head.join('\n')}\\begin{document}\n${title ? '\\maketitle\n' : ''}\n${body}\n\n\\end{document}\n`, warnings };
}

/* ---------------------------------------------------------------- tables */

export interface TableOptions {
  header: boolean;
  aligns: string[]; // per column: l c r or p{3cm}
  style: 'booktabs' | 'grid' | 'plain';
  escaped?: boolean;
  caption?: string;
  label?: string;
  float?: boolean;
  boldHeader?: boolean;
}

function tableLines(rows: string[][], o: TableOptions): string[] {
  const n = Math.max(1, ...rows.map((r) => r.length));
  const spec = Array.from({ length: n }, (_, k) => o.aligns[k] || 'l');
  const colspec = o.style === 'grid' ? `|${spec.join('|')}|` : spec.join('');
  const cell = (c: string) => (o.escaped ? c : latexEscape(c));
  const fmt = (r: string[], isHead: boolean) => Array.from({ length: n }, (_, k) => (isHead && o.boldHeader ? (r[k] ? `\\textbf{${cell(r[k])}}` : '') : cell(r[k] ?? ''))).join(' & ') + ' \\\\';
  const ind = o.float ? '    ' : '  ';
  const lines = [`${o.float ? '  ' : ''}\\begin{tabular}{${colspec}}`];
  if (o.style === 'booktabs') lines.push(`${ind}\\toprule`);
  if (o.style === 'grid') lines.push(`${ind}\\hline`);
  rows.forEach((r, i) => {
    const isHead = o.header && i === 0;
    lines.push(`${ind}${fmt(r, isHead)}`);
    if (o.style === 'grid') lines.push(`${ind}\\hline`);
    else if (isHead && o.style === 'booktabs') lines.push(`${ind}\\midrule`);
  });
  if (o.style === 'booktabs') lines.push(`${ind}\\bottomrule`);
  lines.push(`${o.float ? '  ' : ''}\\end{tabular}`);
  return lines;
}

export function gridToLatex(grid: string[][], o: TableOptions): string {
  const rows = grid.filter((r) => r.some((c) => c.trim()));
  if (!rows.length) return '';
  const body = tableLines(rows, o);
  const pkg = o.style === 'booktabs' ? '% needs \\usepackage{booktabs} in the preamble\n' : '';
  if (!o.float) return pkg + body.join('\n') + '\n';
  const out = ['\\begin{table}[htbp]', '  \\centering'];
  if (o.caption?.trim()) out.push(`  \\caption{${latexEscape(o.caption.trim())}}`);
  if (o.label?.trim()) out.push(`  \\label{${o.label.trim().replace(/[^\w:.-]/g, '-')}}`);
  out.push(...body, '\\end{table}');
  return pkg + out.join('\n') + '\n';
}

/* ---------------------------------------------------------------- word count */

export interface TexCount {
  words: number;
  headingWords: number;
  headings: number;
  captionWords: number;
  inlineMath: number;
  displayMath: number;
  figures: number;
  tables: number;
  citations: number;
  footnotes: number;
}

const countWords = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

export function latexWordCount(src: string): TexCount {
  const clean = src.replace(/(^|[^\\])%.*$/gm, '$1');
  const body = clean.includes('\\begin{document}') ? clean.slice(clean.indexOf('\\begin{document}')) : clean;
  const md = latexToMarkdownDoc(src, { mode: 'doc' }).markdown;
  let words = 0;
  let headingWords = 0;
  let headings = 0;
  let captionWords = 0;
  let inMath = false;
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (line === '$$') {
      inMath = !inMath;
      continue;
    }
    if (inMath || /^```/.test(line) || /^\|\s*-/.test(line)) continue;
    const textOnly = line.replace(/\$[^$]*\$/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\]\([^)]*\)/g, ']').replace(/<https?:[^>]+>/g, ' ');
    if (/^#{1,6}\s/.test(line)) {
      headings++;
      headingWords += countWords(textOnly.replace(/^#+/, ''));
    } else words += countWords(textOnly.replace(/[*_`#>|-]/g, ' '));
  }
  for (const m of body.matchAll(/\\caption\{/g)) {
    const start = (m.index ?? 0) + m[0].length - 1;
    let depth = 0;
    let j = start;
    for (; j < body.length; j++) {
      if (body[j] === '{') depth++;
      else if (body[j] === '}' && --depth === 0) break;
    }
    const n = countWords(body.slice(start + 1, j).replace(/\\[A-Za-z]+/g, ' '));
    captionWords += n;
    words -= Math.min(words, n); // captions were counted in the body text above
  }
  return {
    words,
    headingWords,
    headings,
    captionWords,
    inlineMath: (body.match(/(?<!\\)\$(?!\$)(?:\\.|[^$\\])+?\$/g) ?? []).length + (body.match(/\\\(/g) ?? []).length,
    displayMath: (body.match(/\$\$[\s\S]+?\$\$|\\\[|\\begin\{(equation|align|gather|multline|displaymath|eqnarray)\*?\}/g) ?? []).length,
    figures: (body.match(/\\begin\{figure\*?\}/g) ?? []).length,
    tables: (body.match(/\\begin\{table\*?\}/g) ?? []).length,
    citations: (body.match(/\\cite[pt]?\*?(\[[^\]]*\])*\{[^}]*\}/g) ?? []).reduce((n, c) => n + c.replace(/^[^{]*\{|\}$/g, '').split(',').length, 0),
    footnotes: (body.match(/\\footnote\{/g) ?? []).length,
  };
}
