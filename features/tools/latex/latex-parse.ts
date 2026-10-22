/**
 * A small, safe LaTeX reader. It never runs TeX: it parses the source into a
 * tree (commands, groups, environments, math) and renders that tree as
 * Markdown. Macros defined with \newcommand in the document are expanded, and
 * common CV templates (Jake's resume, moderncv, awesome-cv, resume.cls) get
 * dedicated handling so their entries come out as structured Markdown.
 */

export type Arg = { nodes: Node[]; raw: string };
export type Node =
  | { k: 'text'; s: string }
  | { k: 'cmd'; name: string; star: boolean; opt: Arg[]; args: Arg[] }
  | { k: 'group'; body: Node[] }
  | { k: 'env'; name: string; opt: Arg[]; args: Arg[]; body: Node[]; raw: string }
  | { k: 'math'; s: string; display: boolean }
  | { k: 'nl' }
  | { k: 'amp' }
  | { k: 'par' };

export interface Macro {
  n: number;
  def?: string; // default for an optional first argument
  body: string;
}

/** Mandatory-argument counts for commands we know. Unknown commands take following {…} groups greedily. */
const ARITY: Record<string, number> = {
  // structure
  part: 1, chapter: 1, section: 1, subsection: 1, subsubsection: 1, paragraph: 1, subparagraph: 1,
  title: 1, author: 1, date: 1, maketitle: 0, tableofcontents: 0, appendix: 0,
  // text formatting
  textbf: 1, textit: 1, emph: 1, textsl: 1, textsc: 1, texttt: 1, textrm: 1, textsf: 1, textup: 1, textmd: 1, textnormal: 1,
  underline: 1, uline: 1, text: 1, mbox: 1, hbox: 1, fbox: 1, makebox: 1, framebox: 1, raisebox: 2, parbox: 2,
  textcolor: 2, colorbox: 2, fcolorbox: 3, color: 1, centerline: 1, MakeUppercase: 1, MakeLowercase: 1, uppercase: 1, lowercase: 1,
  href: 2, url: 1, nolinkurl: 1, footnote: 1, footnotetext: 1, cite: 1, citep: 1, citet: 1, ref: 1, eqref: 1, pageref: 1, autoref: 1, label: 1,
  includegraphics: 1, caption: 1, input: 1, include: 1, bibliography: 1, bibliographystyle: 1, bibitem: 1,
  vspace: 1, hspace: 1, vskip: 0, hskip: 0, setlength: 2, addtolength: 2, setcounter: 2, addtocounter: 2, pagestyle: 1, thispagestyle: 1,
  usepackage: 1, documentclass: 1, newgeometry: 1, geometry: 1, hypersetup: 1, urlstyle: 1, titleformat: 5, titlespacing: 4, setlist: 1,
  renewcommand: 2, newcommand: 2, providecommand: 2, DeclareMathOperator: 2, definecolor: 3, colorlet: 2, pagenumbering: 1, linespread: 1, fontsize: 2,
  addbibresource: 1, printbibliography: 0, multicolumn: 3, multirow: 3, cline: 1, rule: 2, phantom: 1, hphantom: 1, vphantom: 1,
  item: 0, hline: 0, toprule: 0, midrule: 0, bottomrule: 0, newline: 0, linebreak: 0, par: 0, noindent: 0, indent: 0, centering: 0,
  raggedright: 0, raggedleft: 0, newpage: 0, clearpage: 0, pagebreak: 0, smallskip: 0, medskip: 0, bigskip: 0, hfill: 0, vfill: 0, hrule: 0, hrulefill: 0, dotfill: 0,
  // CV templates
  cvEntry: 4, cvEntryShort: 2, entryHead: 4, entryHeadOne: 2,
  resumeSubheading: 4, resumeSubSubheading: 2, resumeProjectHeading: 2, resumeItem: 1, resumeSubItem: 1, resumePOR: 3,
  cventry: 6, cvitem: 2, cvlistitem: 1, cvdoubleitem: 4, cvlistdoubleitem: 2, cvitemwithcomment: 3, cvcolumn: 2,
  cvsection: 1, cvsubsection: 1, cvparagraph: 0, cvhonor: 4, cvskill: 2, cvskills: 0,
  name: 2, firstname: 1, familyname: 1, lastname: 1, position: 1, email: 1, mobile: 1, homepage: 1, github: 1, linkedin: 1,
  address: 3, extrainfo: 1, quote: 1, photo: 1, makecvtitle: 0, makecvheader: 0, makecvfooter: 3, moderncvstyle: 1, moderncvcolor: 1,
  social: 1, phone: 1,
  // declarations (switches) never take an argument
  normalsize: 0, small: 0, footnotesize: 0, scriptsize: 0, tiny: 0, large: 0, Large: 0, LARGE: 0, huge: 0, Huge: 0,
  scshape: 0, upshape: 0, mdseries: 0, rmfamily: 0, sffamily: 0, ttfamily: 0, normalfont: 0, bfseries: 0, bf: 0, itshape: 0, it: 0, em: 0,
  slshape: 0, sl: 0, selectfont: 0, protect: 0, relax: 0, leavevmode: 0, strut: 0, ignorespaces: 0, nopagebreak: 0, sloppy: 0, frenchspacing: 0,
};

/** Commands whose optional [..] may be separated from the name by spaces. */
const OPT_WITH_SPACE = new Set(['item', 'phone', 'social', 'section', 'subsection', 'cventry', 'includegraphics', 'documentclass', 'usepackage']);

const ENV_ARGS: Record<string, number> = {
  tabular: 1, 'tabular*': 2, tabularx: 2, 'tabularx*': 2, longtable: 1, array: 1, minipage: 1, multicols: 1, 'multicols*': 1,
  rSection: 1, adjustwidth: 2, wrapfigure: 2, thebibliography: 1, tabu: 1, cvcolumns: 0,
};

const RAW_ENVS = new Set(['verbatim', 'verbatim*', 'lstlisting', 'minted', 'comment', 'Verbatim', 'alltt']);
const MATH_ENVS = new Set(['equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'multline*', 'displaymath', 'eqnarray', 'eqnarray*', 'math', 'flalign', 'flalign*']);

export class LatexParser {
  private i = 0;
  constructor(private src: string, private macros: Map<string, Macro> = new Map()) {}

  parse(): Node[] {
    this.i = 0;
    return this.seq(null);
  }

  private peek(o = 0) {
    return this.src[this.i + o] ?? '';
  }

  private skipSpaces(allowNewline: boolean) {
    const start = this.i;
    let newlines = 0;
    while (this.i < this.src.length) {
      const c = this.src[this.i];
      if (c === ' ' || c === '\t' || c === '\r') this.i++;
      else if (c === '\n' && allowNewline && newlines === 0) {
        newlines++;
        this.i++;
      } else if (c === '%') {
        while (this.i < this.src.length && this.src[this.i] !== '\n') this.i++;
        this.i++; // a comment also swallows its newline
      } else break;
    }
    return start;
  }

  /** Reads one balanced {…} or […] argument. */
  private readArg(open: '{' | '['): Arg | null {
    const close = open === '{' ? '}' : ']';
    if (this.peek() !== open) return null;
    const start = ++this.i;
    let depth = 0;
    let j = this.i;
    for (; j < this.src.length; j++) {
      const c = this.src[j];
      if (c === '\\') {
        j++;
        continue;
      }
      if (c === '%') {
        while (j < this.src.length && this.src[j] !== '\n') j++;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') {
        if (depth === 0 && close === '}') break;
        depth--;
      } else if (c === ']' && close === ']' && depth === 0) break;
    }
    const raw = this.src.slice(start, j);
    this.i = Math.min(j + 1, this.src.length);
    return { raw, nodes: new LatexParser(raw, this.macros).parse() };
  }

  private readOpts(allowSpace: boolean): Arg[] {
    const out: Arg[] = [];
    for (;;) {
      const save = this.i;
      if (allowSpace) this.skipSpaces(false);
      if (this.peek() !== '[') {
        this.i = save;
        return out;
      }
      const a = this.readArg('[');
      if (!a) return out;
      out.push(a);
    }
  }

  private readArgs(n: number | 'greedy'): Arg[] {
    const out: Arg[] = [];
    const max = n === 'greedy' ? 9 : n;
    while (out.length < max) {
      const save = this.i;
      this.skipSpaces(true);
      if (this.peek() !== '{') {
        this.i = save;
        if (n !== 'greedy') {
          // \textbf x: a single-token argument
          const m = /^\s*(\\[A-Za-z]+|[^\s{}\\%])/.exec(this.src.slice(this.i));
          if (m && n !== 0 && out.length === 0 && !/^\s*\\(item|end|begin)\b/.test(this.src.slice(this.i))) {
            this.i += m[0].length;
            const raw = m[1];
            out.push({ raw, nodes: new LatexParser(raw, this.macros).parse() });
            continue;
          }
        }
        break;
      }
      out.push(this.readArg('{')!);
    }
    return out;
  }

  private seq(endEnv: string | '}' | null): Node[] {
    const out: Node[] = [];
    let text = '';
    const flush = () => {
      if (text) out.push({ k: 'text', s: smartText(text) });
      text = '';
    };
    while (this.i < this.src.length) {
      const c = this.src[this.i];
      if (c === '}' && endEnv === '}') {
        this.i++;
        flush();
        return out;
      }
      if (c === '%') {
        while (this.i < this.src.length && this.src[this.i] !== '\n') this.i++;
        this.i++;
        continue;
      }
      if (c === '\n') {
        // blank line = paragraph break
        const m = /^\n[ \t\r]*\n\s*/.exec(this.src.slice(this.i));
        if (m) {
          flush();
          out.push({ k: 'par' });
          this.i += m[0].length;
        } else {
          text += ' ';
          this.i++;
        }
        continue;
      }
      if (c === '{') {
        flush();
        this.i++;
        out.push({ k: 'group', body: this.seq('}') });
        continue;
      }
      if (c === '}') {
        this.i++; // stray brace
        continue;
      }
      if (c === '&') {
        flush();
        out.push({ k: 'amp' });
        this.i++;
        continue;
      }
      if (c === '~') {
        text += ' ';
        this.i++;
        continue;
      }
      if (c === '$') {
        flush();
        const display = this.peek(1) === '$';
        const delim = display ? '$$' : '$';
        const start = this.i + delim.length;
        let j = start;
        while (j < this.src.length && !(this.src.startsWith(delim, j) && this.src[j - 1] !== '\\')) j++;
        out.push({ k: 'math', s: this.src.slice(start, j), display });
        this.i = j + delim.length;
        continue;
      }
      if (c === '\\') {
        const nx = this.peek(1);
        if (nx === '\\') {
          flush();
          this.i += 2;
          if (this.peek() === '*') this.i++;
          const save = this.i;
          this.skipSpaces(false);
          if (this.peek() === '[') this.readArg('[');
          else this.i = save;
          out.push({ k: 'nl' });
          continue;
        }
        if (nx === '(' || nx === '[') {
          flush();
          const close = nx === '(' ? '\\)' : '\\]';
          const j = this.src.indexOf(close, this.i + 2);
          const end = j < 0 ? this.src.length : j;
          out.push({ k: 'math', s: this.src.slice(this.i + 2, end), display: nx === '[' });
          this.i = end + 2;
          continue;
        }
        if (!/[A-Za-z@]/.test(nx)) {
          // control symbol: \& \% \$ \# \_ \{ \} \, \  \- \' etc.
          this.i += 2;
          if ('&%$#_{}'.includes(nx)) text += nx;
          else if (nx === ' ' || nx === ',' || nx === ';' || nx === ':' || nx === '!' || nx === '\n') text += nx === '!' ? '' : ' ';
          else if (nx === '-' || nx === '/' || nx === '@') text += '';
          else if ("'`\"^~=.".includes(nx)) {
            // accents: \'e or \'{e}
            let letter = '';
            if (this.peek() === '{') letter = this.readArg('{')!.raw.replace(/^\\/, '');
            else letter = this.src[this.i++] ?? '';
            text += accent(nx, letter);
          } else text += nx;
          continue;
        }
        const m = /^\\([A-Za-z@]+)(\*?)/.exec(this.src.slice(this.i))!;
        const name = m[1];
        const star = m[2] === '*';
        this.i += m[0].length;
        if (name === 'begin') {
          flush();
          const envArg = this.readArg('{');
          const env = envArg?.raw.trim() ?? '';
          out.push(this.readEnv(env));
          continue;
        }
        if (name === 'end') {
          const envArg = this.readArg('{');
          if (endEnv && envArg && envArg.raw.trim() === endEnv) {
            flush();
            return out;
          }
          continue; // unmatched \end: ignore
        }
        if (name === 'verb') {
          const d = this.src[this.i];
          const j = this.src.indexOf(d, this.i + 1);
          text += this.src.slice(this.i + 1, j < 0 ? undefined : j);
          this.i = j < 0 ? this.src.length : j + 1;
          continue;
        }
        if (['c', 'v', 'u', 'H', 'k', 'r'].includes(name) && (this.peek() === '{' || this.peek() === ' ')) {
          if (this.peek() === ' ') this.i++;
          const letter = this.peek() === '{' ? this.readArg('{')!.raw : this.src[this.i++];
          text += accent(name, letter);
          continue;
        }
        const sym = SYMBOLS[name];
        if (sym !== undefined && !this.macros.has(name)) {
          text += sym;
          if (this.peek() === '{' && this.peek(1) === '}') this.i += 2;
          else if (/^[A-Za-z]/.test(name) && this.peek() === ' ') this.i++; // "\LaTeX is" keeps one space
          continue;
        }
        flush();
        const macro = this.macros.get(name);
        const opt = this.readOpts(OPT_WITH_SPACE.has(name));
        const arity: number | 'greedy' = macro ? Math.max(0, macro.n - (macro.def !== undefined ? 1 : 0)) : name in ARITY ? ARITY[name] : 'greedy';
        if (name === 'newcommand' || name === 'renewcommand' || name === 'providecommand') {
          // \newcommand{\x}[n]{body} inside the body: register and skip
          const target = this.readArgs(1)[0];
          const o = this.readOpts(false);
          const body = this.readArgs(1)[0];
          if (target && body) registerMacro(this.macros, target.raw, o, body.raw);
          continue;
        }
        const args = this.readArgs(arity);
        out.push({ k: 'cmd', name, star, opt, args });
        continue;
      }
      text += c;
      this.i++;
    }
    flush();
    return out;
  }

  private readEnv(env: string): Node {
    const opt = this.readOpts(true);
    if (RAW_ENVS.has(env) || MATH_ENVS.has(env)) {
      const endTag = `\\end{${env}}`;
      const j = this.src.indexOf(endTag, this.i);
      const end = j < 0 ? this.src.length : j;
      const raw = this.src.slice(this.i, end);
      this.i = j < 0 ? this.src.length : end + endTag.length;
      if (MATH_ENVS.has(env)) return { k: 'math', s: raw.trim(), display: true };
      return { k: 'env', name: env, opt, args: [], body: [], raw: raw.replace(/^\n/, '') };
    }
    const n = ENV_ARGS[env] ?? 0;
    const args: Arg[] = [];
    for (let a = 0; a < n; a++) {
      const save = this.i;
      this.skipSpaces(true);
      const x = this.readArg('{');
      if (!x) {
        this.i = save;
        break;
      }
      args.push(x);
    }
    const opt2 = this.readOpts(false);
    const start = this.i;
    const body = this.seq(env);
    return { k: 'env', name: env, opt: [...opt, ...opt2], args, body, raw: this.src.slice(start, this.i) };
  }
}

function smartText(s: string) {
  return s.replace(/---/g, '—').replace(/--/g, '–').replace(/``/g, '“').replace(/''/g, '”').replace(/`/g, '‘');
}

const COMBINING: Record<string, string> = { "'": '́', '`': '̀', '^': '̂', '"': '̈', '~': '̃', '=': '̄', '.': '̇', c: '̧', v: '̌', u: '̆', H: '̋', k: '̨', r: '̊' };
function accent(kind: string, letter: string) {
  const l = letter.replace(/^\\(i|j)$/, '$1');
  if (!l) return '';
  return (l[0] + (COMBINING[kind] ?? '')).normalize('NFC') + l.slice(1);
}

const SYMBOLS: Record<string, string> = {
  LaTeX: 'LaTeX', LaTeXe: 'LaTeX2e', TeX: 'TeX', BibTeX: 'BibTeX', XeLaTeX: 'XeLaTeX', today: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  textbullet: '•', bullet: '•', cdot: '·', textperiodcentered: '·', textbar: '|', vert: '|', textbackslash: '\\', ldots: '…', dots: '…', textellipsis: '…',
  textendash: '–', textemdash: '—', textasciitilde: '~', textasciicircum: '^', textless: '<', textgreater: '>', textquotedblleft: '“', textquotedblright: '”',
  textquoteleft: '‘', textquoteright: '’', textquotesingle: "'", S: '§', P: '¶', copyright: '©', textcopyright: '©', textregistered: '®', texttrademark: '™',
  pounds: '£', textsterling: '£', euro: '€', texteuro: '€', textdollar: '$', textdegree: '°', degree: '°', ss: 'ß', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', o: 'ø', O: 'Ø', aa: 'å', AA: 'Å', l: 'ł', L: 'Ł', i: 'ı',
  quad: ' ', qquad: ' ', enskip: ' ', hfil: ' ', cdotp: '·', textopenbullet: '◦', textdiamond: '◆', enspacebullet: '•', enspace: ' ', thinspace: ' ', space: ' ', nobreakspace: ' ', textvisiblespace: '␣', dag: '†', ddag: '‡', checkmark: '✓', textdagger: '†',
  times: '×', pm: '±', leq: '≤', geq: '≥', le: '≤', ge: '≥', neq: '≠', approx: '≈', sim: '~', rightarrow: '→', leftarrow: '←', to: '→', Rightarrow: '⇒', infty: '∞',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', tau: 'τ', phi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω',
  hfill: ' · ', hrulefill: ' ', dotfill: ' … ', slash: '/', textunderscore: '_', textasteriskcentered: '*', textbraceleft: '{', textbraceright: '}', lbrace: '{', rbrace: '}',
  // icon fonts used in CV headers (fontawesome): drop them
  faPhone: '', faEnvelope: '', faLinkedin: '', faGithub: '', faGlobe: '', faMapMarker: '', faMobile: '', faHome: '', faLinkedinSquare: '', faGithubSquare: '', faAt: '',
};

export function registerMacro(macros: Map<string, Macro>, targetRaw: string, opts: Arg[], body: string) {
  const name = targetRaw.trim().replace(/^\\/, '');
  if (!/^[A-Za-z@]+$/.test(name)) return;
  const n = opts[0] ? parseInt(opts[0].raw, 10) || 0 : 0;
  macros.set(name, { n, def: opts[1]?.raw, body });
}

/** Finds \newcommand / \renewcommand / \def definitions anywhere in the source. */
export function collectMacros(src: string): Map<string, Macro> {
  const macros = new Map<string, Macro>();
  const re = /\\(?:re)?newcommand\*?\s*(?:\{\s*(\\[A-Za-z@]+)\s*\}|(\\[A-Za-z@]+))\s*((?:\[[^\]]*\]\s*){0,2})\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1] ?? m[2];
    const optsRaw = [...m[3].matchAll(/\[([^\]]*)\]/g)].map((x) => x[1]);
    const bodyStart = re.lastIndex; // just after the opening brace
    const body = readBalanced(src, bodyStart - 1);
    if (body === null) continue;
    re.lastIndex = bodyStart + body.length + 1;
    macros.set(name.slice(1), { n: optsRaw[0] ? parseInt(optsRaw[0], 10) || 0 : 0, def: optsRaw[1], body });
  }
  const defRe = /\\def\s*(\\[A-Za-z@]+)((?:#\d)*)\s*\{/g;
  while ((m = defRe.exec(src))) {
    const body = readBalanced(src, defRe.lastIndex - 1);
    if (body === null) continue;
    macros.set(m[1].slice(1), { n: (m[2].match(/#/g) ?? []).length, body });
  }
  return macros;
}

/** Returns the text inside the balanced braces that open at src[open]. */
export function readBalanced(src: string, open: number): string | null {
  if (src[open] !== '{') return null;
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') {
      j++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(open + 1, j);
    }
  }
  return null;
}

/** Removes % comments (keeping \%). */
export function stripComments(src: string): string {
  return src.replace(/(^|[^\\])((?:\\\\)*)%.*$/gm, '$1$2');
}

/** Zero-argument macros are expanded as text first, so ones that open or close environments work. */
export function expandSimpleMacros(src: string, macros: Map<string, Macro>, keep: Set<string>): string {
  let out = src;
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const [name, m] of macros) {
      if (m.n !== 0 || keep.has(name)) continue;
      const re = new RegExp(`\\\\${name.replace(/@/g, '\\@')}(?![A-Za-z@])(\\s*\\{\\})?`, 'g');
      if (re.test(out)) {
        out = out.replace(re, () => m.body);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

/* ------------------------------------------------------------------ render */

export interface RenderOptions {
  /** 'cv' flattens tables into lines and simplifies math; 'doc' keeps tables, math and figures. */
  mode: 'cv' | 'doc';
}

interface Ctx {
  opts: RenderOptions;
  macros: Map<string, Macro>;
  list: Array<'ul' | 'ol' | 'dl'>;
  counters: number[];
  depth: number;
  meta: { title?: string; author?: string; date?: string };
}

const DROP = new Set([
  'vspace', 'hspace', 'setlength', 'addtolength', 'setcounter', 'addtocounter', 'pagestyle', 'thispagestyle', 'usepackage', 'documentclass', 'geometry', 'newgeometry',
  'hypersetup', 'urlstyle', 'titleformat', 'titlespacing', 'setlist', 'definecolor', 'colorlet', 'pagenumbering', 'linespread', 'fontsize', 'label', 'color',
  'bibliographystyle', 'addbibresource', 'input', 'include', 'phantom', 'hphantom', 'vphantom', 'rule', 'hrule', 'moderncvstyle', 'moderncvcolor', 'photo',
  'makecvfooter', 'vskip', 'hskip', 'noindent', 'indent', 'centering', 'raggedright', 'raggedleft', 'newpage', 'clearpage', 'pagebreak', 'smallskip', 'medskip',
  'bigskip', 'vfill', 'hline', 'toprule', 'midrule', 'bottomrule', 'cline', 'tableofcontents', 'appendix', 'printbibliography', 'normalsize', 'small', 'footnotesize',
  'scriptsize', 'tiny', 'large', 'Large', 'LARGE', 'huge', 'Huge', 'scshape', 'upshape', 'mdseries', 'rmfamily', 'sffamily', 'ttfamily', 'normalfont', 'selectfont',
  'fontfamily', 'fontseries', 'fontshape', 'makecvtitle', 'makecvheader', 'name', 'firstname', 'familyname', 'lastname', 'position', 'email', 'mobile', 'homepage',
  'github', 'linkedin', 'address', 'extrainfo', 'quote', 'social', 'phone', 'title', 'author', 'date', 'pdfgentounicode', 'input@path', 'ignorespaces', 'protect',
  'relax', 'leavevmode', 'nopagebreak', 'filbreak', 'strut', 'null', 'onecolumn', 'twocolumn', 'flushbottom', 'raggedbottom', 'frenchspacing', 'sloppy',
]);

const BOLD_SWITCH = new Set(['bfseries', 'bf']);
const ITALIC_SWITCH = new Set(['itshape', 'it', 'em', 'slshape', 'sl']);

function argText(a: Arg | undefined, ctx: Ctx): string {
  return a ? renderNodes(a.nodes, ctx).trim() : '';
}

function inline(s: string) {
  return s.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function wrap(mark: string, s: string) {
  const t = s.trim();
  if (!t) return '';
  const lead = /^\s/.test(s) ? ' ' : '';
  const tail = /\s$/.test(s) ? ' ' : '';
  return `${lead}${mark}${t}${mark}${tail}`;
}

function mathText(s: string, ctx: Ctx, display: boolean): string {
  if (ctx.opts.mode === 'doc') return display ? `\n\n$$\n${s.trim()}\n$$\n\n` : `$${s}$`;
  // CV mode: show simple math as text ($|$ separators, 3.8/4.0, x^2…)
  const nodes = new LatexParser(s, ctx.macros).parse();
  return renderNodes(nodes, ctx).replace(/[\^_]\{?([^}\s]*)\}?/g, '$1').replace(/\{|\}/g, '');
}

function isDateLike(s: string) {
  return /\b(19|20)\d{2}\b|present|current/i.test(s) && s.length < 40;
}

function entryMd(titleIn: string, org: string, location: string, dates: string, extra: string[] = []) {
  // "Project ([site.dev](https://site.dev))" → title plus a link line
  let title = titleIn;
  const link = /\s*\((\[[^\]]+\]\([^)]+\)|<[^>]+>)\)\s*$/.exec(title);
  if (link) {
    title = title.slice(0, link.index);
    extra = [...extra, link[1]];
  }
  const head = [inline(title), inline(org)].filter(Boolean).join(' — ');
  const meta = [inline(location), inline(dates)].filter(Boolean).join(' · ');
  const lines = [`\n\n### ${head || inline(location) || 'Entry'}`];
  if (meta && head) lines.push(`*${meta}*`);
  for (const e of extra) if (e.trim()) lines.push(e.trim());
  return lines.join('\n') + '\n';
}

function expandMacro(m: Macro, opt: Arg[], args: Arg[]): string {
  const vals: string[] = [];
  if (m.def !== undefined) vals.push(opt[0]?.raw ?? m.def);
  for (const a of args) vals.push(a.raw);
  return m.body.replace(/#(\d)/g, (_x, d: string) => vals[Number(d) - 1] ?? '');
}

function renderCmd(n: Extract<Node, { k: 'cmd' }>, ctx: Ctx): string {
  const a = (i: number) => argText(n.args[i], ctx);
  const doc = ctx.opts.mode === 'doc';
  switch (n.name) {
    case 'part':
    case 'chapter':
      return `\n\n# ${inline(a(0))}\n\n`;
    case 'section':
    case 'cvsection':
      return `\n\n## ${inline(a(0))}\n\n`;
    case 'subsection':
    case 'cvsubsection':
      return `\n\n### ${inline(a(0))}\n\n`;
    case 'subsubsection':
      return `\n\n#### ${inline(a(0))}\n\n`;
    case 'paragraph':
    case 'subparagraph':
      return `\n\n**${inline(a(0))}** `;
    case 'maketitle': {
      const { title, author, date } = ctx.meta;
      return [title && `# ${inline(title)}`, author && inline(author.replace(/\\and/g, ', ')), date && inline(date)].filter(Boolean).join('\n\n') + '\n\n';
    }
    case 'textbf':
      return wrap('**', a(0));
    case 'textit':
    case 'emph':
    case 'textsl':
      return wrap('*', a(0));
    case 'texttt':
      return doc ? wrap('`', a(0)) : a(0);
    case 'href': {
      const url = n.args[0]?.raw.trim().replace(/\\([%#&_])/g, '$1') ?? '';
      const label = inline(a(1));
      if (!url) return label;
      if (!label || label === url) return `<${url}>`;
      return `[${label}](${url})`;
    }
    case 'url':
    case 'nolinkurl':
      return `<${n.args[0]?.raw.trim() ?? ''}>`;
    case 'footnote':
      return doc ? ` (${inline(a(0))})` : '';
    case 'cite':
    case 'citep':
    case 'citet':
      return `[${(n.args[0]?.raw ?? '').split(',').map((s) => s.trim()).join(', ')}]`;
    case 'ref':
    case 'eqref':
    case 'pageref':
    case 'autoref':
      return doc ? `(${n.args[0]?.raw.trim() ?? ''})` : '';
    case 'includegraphics':
      return doc ? `![](${n.args[0]?.raw.trim() ?? ''})` : '';
    case 'caption':
      return doc ? `\n\n*${inline(a(0))}*\n\n` : '';
    case 'bibitem':
      return `\n- [${n.args[0]?.raw.trim() ?? ''}] `;
    case 'item': {
      const kind = ctx.list[ctx.list.length - 1] ?? 'ul';
      const indent = '  '.repeat(Math.max(0, ctx.list.length - 1));
      const label = n.opt[0] ? inline(argText(n.opt[0], ctx)) : '';
      if (kind === 'ol') {
        const k = ctx.counters.length - 1;
        ctx.counters[k] = (ctx.counters[k] ?? 0) + 1;
        return `\n${indent}${ctx.counters[k]}. `;
      }
      if (label) return `\n${indent}- **${label.replace(/:$/, '')}:** `;
      return `\n${indent}- `;
    }
    case 'newline':
    case 'linebreak':
      return '\n';
    case 'par':
      return '\n\n';
    case 'centerline':
      return `\n${a(0)}\n`;
    case 'textcolor':
    case 'colorbox':
      return a(1);
    case 'fcolorbox':
      return a(2);
    case 'raisebox':
    case 'parbox':
      return a(n.args.length - 1);
    case 'MakeUppercase':
    case 'uppercase':
      return a(0).toUpperCase();
    case 'MakeLowercase':
    case 'lowercase':
      return a(0).toLowerCase();
    case 'multicolumn':
    case 'multirow':
      return a(2);
    // ---- Jake's resume and friends
    case 'resumeSubheading':
      // Education rows are {school}{place}{degree}{dates}; experience rows are often {role}{dates}{company}{place}.
      if (isDateLike(a(1)) && !isDateLike(a(3))) return entryMd(a(0), a(2), a(3), a(1));
      return entryMd(a(2), a(0), a(1), a(3));
    // UsamaVerse's own templates (so its LaTeX converts back losslessly)
    case 'cvEntry':
      return entryMd(a(0), a(1), a(2), a(3));
    case 'cvEntryShort':
    case 'entryHeadOne':
      return entryMd(a(0), '', '', a(1));
    case 'entryHead':
      return entryMd(a(0), a(2), a(3), a(1));
    case 'resumeSubSubheading':
      return entryMd(a(0), '', '', a(1));
    case 'resumeProjectHeading': {
      const parts = inline(a(0)).split(/\s*\|\s*/);
      return entryMd(parts[0], parts.slice(1).join(', '), '', a(1));
    }
    case 'resumePOR':
      return entryMd(a(1), a(0), '', a(2));
    case 'resumeItem':
    case 'resumeSubItem':
      if (n.args.length >= 2 && a(1)) return `\n- **${inline(a(0)).replace(/:$/, '')}:** ${inline(a(1))}`;
      return `\n- ${inline(a(0))}`;
    // ---- moderncv / awesome-cv
    case 'cventry': {
      if (n.args.length >= 6 || isDateLike(a(0))) {
        // moderncv: {dates}{title}{employer}{city}{grade}{description}
        const desc = a(5);
        return entryMd(a(1), a(2), a(3), a(0), [a(4) && inline(a(4)), desc]);
      }
      // awesome-cv: {position}{organization}{location}{date}{description}
      return entryMd(a(0), a(1), a(2), a(3), [a(4)]);
    }
    case 'cvitem':
    case 'cvskill':
      return a(0) ? `\n- **${inline(a(0)).replace(/:$/, '')}:** ${inline(a(1))}` : `\n- ${inline(a(1))}`;
    case 'cvitemwithcomment':
      return `\n- **${inline(a(0))}:** ${inline(a(1))}${a(2) ? ` (${inline(a(2))})` : ''}`;
    case 'cvlistitem':
      return `\n- ${inline(a(0))}`;
    case 'cvdoubleitem':
      return `\n- **${inline(a(0))}:** ${inline(a(1))}\n- **${inline(a(2))}:** ${inline(a(3))}`;
    case 'cvlistdoubleitem':
      return `\n- ${inline(a(0))}\n- ${inline(a(1))}`;
    case 'cvhonor':
      return `\n- ${[a(0), a(1), a(2)].map(inline).filter(Boolean).join(', ')}${a(3) ? ` (${inline(a(3))})` : ''}`;
    case 'cvcolumn':
      return `\n- **${inline(a(0))}:** ${inline(a(1))}`;
  }
  if (DROP.has(n.name)) return '';
  if (BOLD_SWITCH.has(n.name) || ITALIC_SWITCH.has(n.name)) return '';
  const macro = ctx.macros.get(n.name);
  if (macro && ctx.depth < 12) {
    const expanded = expandMacro(macro, n.opt, n.args);
    const sub = { ...ctx, depth: ctx.depth + 1 };
    return renderNodes(new LatexParser(expanded, ctx.macros).parse(), sub);
  }
  // Unknown command: keep the text of its arguments.
  return n.args.map((x) => argText(x, ctx)).filter(Boolean).join(' ');
}

function renderGroup(body: Node[], ctx: Ctx): string {
  const first = body.find((x) => !(x.k === 'text' && !x.s.trim()));
  let inner = renderNodes(body, ctx);
  if (first?.k === 'cmd' && BOLD_SWITCH.has(first.name)) inner = wrap('**', inner);
  else if (first?.k === 'cmd' && ITALIC_SWITCH.has(first.name)) inner = wrap('*', inner);
  return inner;
}

function splitRows(body: Node[]): Node[][][] {
  const rows: Node[][][] = [];
  let row: Node[][] = [[]];
  for (const x of body) {
    if (x.k === 'nl') {
      rows.push(row);
      row = [[]];
    } else if (x.k === 'amp') row.push([]);
    else row[row.length - 1].push(x);
  }
  rows.push(row);
  return rows;
}

function renderTable(env: Extract<Node, { k: 'env' }>, ctx: Ctx): string {
  const rows = splitRows(env.body)
    .map((r) => r.map((cell) => inline(renderNodes(cell, ctx))))
    .filter((r) => r.some((c) => c));
  if (!rows.length) return '';
  if (ctx.opts.mode === 'cv') return '\n' + rows.map((r) => r.filter(Boolean).join(' · ')).join('\n') + '\n';
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')].map((c) => c.replace(/\|/g, '\\|'));
  const lines = [`| ${pad(rows[0]).join(' | ')} |`, `| ${Array(width).fill('---').join(' | ')} |`, ...rows.slice(1).map((r) => `| ${pad(r).join(' | ')} |`)];
  return `\n\n${lines.join('\n')}\n\n`;
}

function renderEnv(n: Extract<Node, { k: 'env' }>, ctx: Ctx): string {
  const doc = ctx.opts.mode === 'doc';
  switch (n.name) {
    case 'itemize':
    case 'enumerate':
    case 'description':
    case 'compactitem':
    case 'compactenum':
    case 'cvitems':
    case 'highlights':
    case 'onecolentry': {
      const kind = n.name === 'enumerate' || n.name === 'compactenum' ? 'ol' : n.name === 'description' ? 'dl' : 'ul';
      const sub: Ctx = { ...ctx, list: [...ctx.list, kind], counters: [...ctx.counters, 0] };
      const out = renderNodes(n.body, sub).replace(/\n{2,}(?=\s*(?:-|\d+\.) )/g, '\n');
      return `\n${out}\n`;
    }
    case 'tabular':
    case 'tabular*':
    case 'tabularx':
    case 'tabularx*':
    case 'longtable':
    case 'array':
    case 'tabu':
      return renderTable(n, ctx);
    case 'rSection':
      return `\n\n## ${inline(argText(n.args[0], ctx))}\n\n${renderNodes(n.body, ctx)}`;
    case 'verbatim':
    case 'verbatim*':
    case 'lstlisting':
    case 'minted':
    case 'Verbatim':
    case 'alltt':
      return doc ? `\n\n\`\`\`\n${n.raw.replace(/\s+$/, '')}\n\`\`\`\n\n` : '';
    case 'comment':
      return '';
    case 'quote':
    case 'quotation':
    case 'verse':
      return doc ? `\n\n${renderNodes(n.body, ctx).trim().split('\n').map((l) => `> ${l}`).join('\n')}\n\n` : renderNodes(n.body, ctx);
    case 'abstract':
      return `\n\n**Abstract.** ${renderNodes(n.body, ctx).trim()}\n\n`;
    case 'thebibliography':
      return `\n\n## References\n${renderNodes(n.body, { ...ctx, list: [...ctx.list, 'ul'] })}\n\n`;
    case 'figure':
    case 'figure*':
    case 'table':
    case 'table*':
    case 'wrapfigure':
      return doc ? `\n\n${renderNodes(n.body, ctx).trim()}\n\n` : '';
    case 'document':
      return renderNodes(n.body, ctx);
    default:
      return `\n${renderNodes(n.body, ctx)}\n`;
  }
}

export function renderNodes(nodes: Node[], ctx: Ctx): string {
  let out = '';
  for (const n of nodes) {
    switch (n.k) {
      case 'text':
        out += ctx.list.length ? n.s : n.s;
        break;
      case 'group':
        out += renderGroup(n.body, ctx);
        break;
      case 'cmd':
        if (n.name === 'title') ctx.meta.title = argText(n.args[0], ctx);
        else if (n.name === 'author') ctx.meta.author = argText(n.args[0], ctx);
        else if (n.name === 'date') ctx.meta.date = argText(n.args[0], ctx);
        out += renderCmd(n, ctx);
        break;
      case 'env':
        out += renderEnv(n, ctx);
        break;
      case 'math':
        out += mathText(n.s, ctx, n.display);
        break;
      case 'nl':
        out += '\n';
        break;
      case 'amp':
        out += ctx.opts.mode === 'cv' ? ' · ' : ' & ';
        break;
      case 'par':
        out += '\n\n';
        break;
    }
  }
  return out;
}

/** Tidies rendered Markdown: trims lines, collapses blank lines and stray separators. */
export function tidyMarkdown(s: string): string {
  return s
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) =>
      l
        .replace(/[ \t]+/g, ' ')
        .replace(/(?:\s*·\s*){2,}/g, ' · ')
        .replace(/^\s*·\s*|\s*·\s*$/g, '')
        .replace(/\*\*\s*\*\*/g, '')
        .trimEnd()
        .replace(/^ (?! *(?:-|\d+\.) )/, ''),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface LatexDoc {
  /** Body converted to Markdown. */
  markdown: string;
  /** Header fields found via \name, \email… (moderncv / awesome-cv style). */
  header: Record<string, string>;
  warnings: string[];
}

function cmdArgs(src: string, name: string): string[][] {
  const out: string[][] = [];
  const re = new RegExp(`\\\\${name}\\*?\\s*(?:\\[([^\\]]*)\\])?\\s*\\{`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const args: string[] = [];
    if (m[1] !== undefined) args.push(`[${m[1]}]`);
    let pos = re.lastIndex - 1;
    for (let k = 0; k < 4; k++) {
      const v = readBalanced(src, pos);
      if (v === null) break;
      args.push(v);
      pos += v.length + 2;
      while (src[pos] === ' ' || src[pos] === '\n') pos++;
      if (src[pos] !== '{') break;
    }
    out.push(args);
  }
  return out;
}

function plainFromLatex(s: string, macros: Map<string, Macro>): string {
  const ctx: Ctx = { opts: { mode: 'cv' }, macros, list: [], counters: [], depth: 0, meta: {} };
  return inline(renderNodes(new LatexParser(s, macros).parse(), ctx).replace(/\u00a0/g, ' ')).replace(/\*\*|\*/g, '').replace(/^<|>$/g, '');
}

/** Converts a whole LaTeX document (preamble optional) to Markdown. */
export function latexToMarkdownDoc(src: string, opts: RenderOptions): LatexDoc {
  const warnings: string[] = [];
  const clean = stripComments(src.replace(/\r\n?/g, '\n'));
  const macros = collectMacros(clean);
  const semantic = new Set(Object.keys(ARITY).filter((k) => /^(resume|cv)/.test(k)));
  const b0 = clean.indexOf('\\begin{document}');
  const b1 = clean.lastIndexOf('\\end{document}');
  const preamble = b0 >= 0 ? clean.slice(0, b0) : '';
  let body = b0 >= 0 ? clean.slice(b0 + '\\begin{document}'.length, b1 > b0 ? b1 : undefined) : clean;
  if (b0 < 0 && /\\documentclass/.test(clean)) warnings.push('No \\begin{document} was found, so the whole file was read as the body.');
  body = expandSimpleMacros(body, macros, semantic);

  // Header commands live in the preamble for moderncv/awesome-cv.
  const header: Record<string, string> = {};
  const scope = preamble + '\n' + body.slice(0, 4000);
  const first = (name: string) => cmdArgs(scope, name)[0];
  const nm = first('name');
  if (nm && nm.filter((x) => !x.startsWith('[')).length >= 1) header.name = nm.filter((x) => !x.startsWith('[')).slice(0, 2).map((x) => plainFromLatex(x, macros)).join(' ').trim();
  const fn = first('firstname');
  const ln = first('familyname') ?? first('lastname');
  if (!header.name && (fn || ln)) header.name = [fn?.[0], ln?.[0]].filter(Boolean).map((x) => plainFromLatex(x!, macros)).join(' ');
  const t = first('position') ?? (/moderncv/.test(preamble) ? first('title') : undefined);
  if (t) header.label = plainFromLatex(t[t.length - 1], macros);
  for (const key of ['email', 'homepage', 'github', 'linkedin', 'extrainfo']) {
    const v = first(key);
    if (v) header[key] = plainFromLatex(v[v.length - 1], macros);
  }
  for (const v of [...cmdArgs(scope, 'phone'), ...cmdArgs(scope, 'mobile')]) {
    header.phone ||= plainFromLatex(v[v.length - 1], macros);
  }
  for (const v of cmdArgs(scope, 'social')) {
    const kind = (v[0] ?? '').replace(/[[\]]/g, '').toLowerCase();
    const val = plainFromLatex(v[v.length - 1], macros);
    if (kind.includes('linkedin')) header.linkedin ||= `linkedin.com/in/${val.replace(/^.*linkedin\.com\/in\//, '')}`;
    else if (kind.includes('github')) header.github ||= `github.com/${val.replace(/^.*github\.com\//, '')}`;
    else header.website ||= val;
  }
  if (header.github && !/github\.com/i.test(header.github)) header.github = `github.com/${header.github.replace(/^@/, '')}`;
  if (header.linkedin && !/linkedin\.com/i.test(header.linkedin)) header.linkedin = `linkedin.com/in/${header.linkedin}`;
  const addr = first('address');
  if (addr) header.location = addr.filter((x) => !x.startsWith('[')).map((x) => plainFromLatex(x, macros)).filter(Boolean).join(', ');

  const ctx: Ctx = { opts, macros, list: [], counters: [], depth: 0, meta: {} };
  // \title etc. may be set in the preamble for articles.
  for (const k of ['title', 'author', 'date'] as const) {
    if (!/moderncv/.test(preamble)) {
      const v = cmdArgs(preamble, k)[0];
      if (v) ctx.meta[k] = plainFromLatex(v[v.length - 1], macros);
    }
  }
  let md: string;
  try {
    md = renderNodes(new LatexParser(body, macros).parse(), ctx);
  } catch (e) {
    warnings.push(`Part of the document could not be read (${e instanceof Error ? e.message : String(e)}).`);
    md = '';
  }
  return { markdown: tidyMarkdown(md), header, warnings };
}

/** Markdown → plain text: drops #, emphasis and link syntax. */
export function markdownToPlain(md: string): string {
  return md
    .split('\n')
    .map((l) =>
      l
        .replace(/^#{1,6}\s+(.*)$/, (_m, h: string) => h.toUpperCase())
        .replace(/^(\s*)[-*]\s+/, '$1• ')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t: string, u: string) => (t === u ? u : `${t} (${u})`))
        .replace(/<((?:https?|mailto):[^>]+)>/g, '$1')
        .replace(/(\*\*|__)(.+?)\1/g, '$2')
        .replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '$1$2')
        .replace(/`([^`]+)`/g, '$1'),
    )
    .join('\n');
}
