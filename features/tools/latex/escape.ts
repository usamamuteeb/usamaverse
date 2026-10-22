/** Escapes plain text so LaTeX prints it literally (works with pdfLaTeX, XeLaTeX and LuaLaTeX). */
export function latexEscape(s: string, opts: { keepNewlines?: boolean } = {}): string {
  let out = s.replace(/[\\{}&%$#_~^]/g, (c) => {
    switch (c) {
      case '\\':
        return '\\textbackslash{}';
      case '~':
        return '\\textasciitilde{}';
      case '^':
        return '\\textasciicircum{}';
      default:
        return `\\${c}`;
    }
  });
  // Characters that pdfLaTeX's T1/utf8 setup may not have, mapped to safe commands.
  out = out
    .replace(/\u2022/g, '\\textbullet{}')
    .replace(/\u2026/g, '\\ldots{}')
    .replace(/\u00a0/g, '~')
    .replace(/</g, '\\textless{}')
    .replace(/>/g, '\\textgreater{}')
    .replace(/\|/g, '\\textbar{}');
  if (opts.keepNewlines) out = out.replace(/\n{2,}/g, '\n\n').replace(/([^\n])\n(?!\n)/g, '$1\\\\\n');
  return out;
}

/** Escapes a URL for \href / \url (only %, # and backslash need care). */
export function latexUrl(url: string): string {
  return url.replace(/\\/g, '/').replace(/([%#])/g, '\\$1').replace(/[{}]/g, '');
}

const UNESCAPE: Array<[RegExp, string]> = [
  [/(?<!\\)~/g, ' '],
  [/\\textbackslash(\{\})?/g, '\\'],
  [/\\textasciitilde(\{\})?/g, '~'],
  [/\\textasciicircum(\{\})?/g, '^'],
  [/\\textless(\{\})?/g, '<'],
  [/\\textgreater(\{\})?/g, '>'],
  [/\\textbar(\{\})?/g, '|'],
  [/\\textbullet(\{\})?/g, '•'],
  [/\\ldots(\{\})?/g, '…'],
  [/\\([&%$#_{}])/g, '$1'],
];

/** Reverses latexEscape for simple text (not a full LaTeX renderer — see latexToMarkdown). */
export function latexUnescape(s: string): string {
  let out = s;
  for (const [re, rep] of UNESCAPE) out = out.replace(re, rep);
  return out;
}
