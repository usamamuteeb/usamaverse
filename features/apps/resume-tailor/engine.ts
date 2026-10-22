/**
 * Resume Tailor engine — rule-based, no AI model.
 * It edits your own LaTeX resume in place (so your template and design stay
 * exactly as they are) and only ever uses content you supplied:
 *  - experience/project bullets are ranked against the job description and
 *    the best ones (including alternates from your bullet bank) are chosen,
 *    preferring bullets in your target length range;
 *  - skills inside each skills line are reordered (matches first) and skills
 *    from your skill bank that the job asks for are added;
 *  - 2–3 of your listed certifications that fit the job are shown as plain titles;
 *  - the summary can be rebuilt from your template, and a headline swapped.
 * Every change is logged, and the keyword match score is measured before and after.
 */
import { latexEscape, latexUnescape } from '@/features/tools/latex/escape';
import { latexToMarkdownDoc, markdownToPlain, readBalanced } from '@/features/tools/latex/latex-parse';
import { countIn, extractKeywords, matchKeywords, type Keyword, type MatchResult } from '@/features/tools/career/job-logic';
import { sectionRole } from '@/features/tools/career/cv-model';
import { CERT_CATALOG } from './defaults';

export interface TailorSettings {
  baseTex: string;
  bulletBank: string;
  skillBank: string;
  certs: string;
  certCount: number;
  summaryTemplate: string;
  years: string;
  headline: string;
  rewriteSummary: boolean;
  reorderBullets: boolean;
  useBank: boolean;
  reorderSkills: boolean;
  addSkills: boolean;
  addCerts: boolean;
  replaceHeadline: boolean;
  minChars: number;
  maxChars: number;
}

export interface JobInput {
  jd: string;
  role: string;
  company: string;
}

export interface BulletReport {
  where: string;
  text: string;
  chars: number;
  status: 'ok' | 'short' | 'long';
  fromBank: boolean;
}

export interface TailorResult {
  tex: string;
  changes: string[];
  before: MatchResult;
  after: MatchResult;
  bullets: BulletReport[];
  certsUsed: string[];
  certSuggestions: string[];
  warnings: string[];
}

/* ------------------------------------------------------------ helpers */

const plainCache = new Map<string, string>();
export function plainOf(latex: string): string {
  const hit = plainCache.get(latex);
  if (hit !== undefined) return hit;
  const md = latexToMarkdownDoc(latex, { mode: 'cv' }).markdown;
  const out = md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<((?:https?|mailto):[^>]+)>/g, '$1')
    .replace(/\*\*|(?<!\w)\*|\*(?!\w)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plainCache.size > 2000) plainCache.clear();
  plainCache.set(latex, out);
  return out;
}

export function documentPlain(tex: string): string {
  return markdownToPlain(latexToMarkdownDoc(tex, { mode: 'cv' }).markdown);
}

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

interface Section {
  heading: string;
  start: number;
  contentStart: number;
  end: number;
}

export function findSections(tex: string): Section[] {
  const docEnd = tex.lastIndexOf('\\end{document}');
  const limit = docEnd >= 0 ? docEnd : tex.length;
  const begin = Math.max(0, tex.indexOf('\\begin{document}'));
  const out: Section[] = [];
  const re = /\\(?:section|cvsection)\*?\s*\{/g;
  re.lastIndex = begin;
  for (let m = re.exec(tex); m && m.index < limit; m = re.exec(tex)) {
    const brace = m.index + m[0].length - 1;
    const head = readBalanced(tex, brace);
    if (head === null) continue;
    out.push({ heading: plainOf(head) || head, start: m.index, contentStart: brace + head.length + 2, end: limit });
  }
  for (let i = 0; i < out.length - 1; i++) out[i].end = out[i + 1].start;
  return out;
}

interface Bullet {
  start: number;
  end: number;
  raw: string;
  inner: string;
  kind: 'resumeItem' | 'item';
}

function findBullets(tex: string, from: number, to: number): Bullet[] {
  const seg = tex.slice(from, to);
  const out: Bullet[] = [];
  const ri = /\\resumeItem\s*\{/g;
  for (let m = ri.exec(seg); m; m = ri.exec(seg)) {
    const brace = m.index + m[0].length - 1;
    const inner = readBalanced(seg, brace);
    if (inner === null) continue;
    const end = brace + inner.length + 2;
    out.push({ start: from + m.index, end: from + end, raw: seg.slice(m.index, end), inner, kind: 'resumeItem' });
    ri.lastIndex = end;
  }
  if (out.length) return out;
  const it = /\\item\b/g;
  const marks: number[] = [];
  for (let m = it.exec(seg); m; m = it.exec(seg)) marks.push(m.index);
  marks.forEach((s, k) => {
    let e = k + 1 < marks.length ? marks[k + 1] : seg.length;
    const close = seg.slice(s, e).search(/\\end\{(itemize|enumerate)\}/);
    if (close >= 0) e = s + close;
    let body = seg.slice(s, e);
    if (/\\begin\{(itemize|enumerate)\}/.test(body)) return; // an outer item that holds a nested list
    body = body.replace(/\s+$/, '');
    const inner = body.replace(/^\\item\s*(\[[^\]]*\])?\s*/, '');
    // Skip items whose braces are unbalanced (e.g. \small{\item{…}} wrappers) — too risky to rewrite.
    let depth = 0;
    for (const ch of inner.replace(/\\[{}]/g, '')) depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
    if (depth !== 0) return;
    out.push({ start: from + s, end: from + s + body.length, raw: body, inner, kind: 'item' });
  });
  return out;
}

const BLOCK_BREAK = /\\(resume\w*(Heading|ListEnd|ListStart)|resumeSubheading|cventry|textbf|section|(begin|end)\{(itemize|enumerate)\})/i;

interface Block {
  header: string;
  label: string;
  full: string;
  bullets: Bullet[];
}

function blocksIn(tex: string, sec: Section): Block[] {
  const bullets = findBullets(tex, sec.contentStart, sec.end);
  const blocks: Block[] = [];
  let prevEnd = sec.contentStart;
  for (const b of bullets) {
    const last = blocks[blocks.length - 1];
    const gap = tex.slice(last ? last.bullets[last.bullets.length - 1].end : prevEnd, b.start);
    if (!last || BLOCK_BREAK.test(gap)) {
      const header = tex.slice(last ? last.bullets[last.bullets.length - 1].end : prevEnd, b.start);
      const firstLine = latexToMarkdownDoc(header, { mode: 'cv' }).markdown.split('\n').find((l) => l.trim()) ?? '';
      const label = (plainOf(header).length ? firstLine.replace(/^#{1,6}\s+/, '').replace(/\*+/g, '').trim() : '').slice(0, 120) || plainOf(header).slice(0, 120);
      blocks.push({ header, label, full: plainOf(header), bullets: [b] });
    } else last.bullets.push(b);
    prevEnd = b.end;
  }
  return blocks;
}

/** "[Company]\n- bullet" groups. */
export function parseBank(text: string): Array<{ label: string; bullets: string[] }> {
  const out: Array<{ label: string; bullets: string[] }> = [];
  let cur: { label: string; bullets: string[] } | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const h = /^\[(.+)\]$/.exec(line) ?? /^#{1,3}\s+(.+)$/.exec(line);
    if (h) {
      cur = { label: h[1].trim(), bullets: [] };
      out.push(cur);
    } else if (cur) cur.bullets.push(line.replace(/^[-*•]\s*/, ''));
  }
  return out;
}

function scorer(kws: Keyword[], min: number, max: number) {
  return (text: string) => {
    let s = 0;
    for (const k of kws) if (countIn(text, k.term) > 0) s += k.weight;
    if (/\d/.test(text)) s += 0.5;
    const n = text.length;
    if (n < min) s -= (min - n) / 30;
    if (n > max) s -= (n - max) / 30;
    return s;
  };
}

export function detectJob(jd: string): { role: string; company: string } {
  const lines = jd.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let role = '';
  let company = '';
  const titleLine = lines.find((l) => /^(job\s*)?title\s*:/i.test(l));
  if (titleLine) role = titleLine.replace(/^(job\s*)?title\s*:\s*/i, '');
  const compLine = lines.find((l) => /^(company|employer|organisation|organization)\s*:/i.test(l));
  if (compLine) company = compLine.replace(/^[^:]+:\s*/, '');
  const first = lines[0] ?? '';
  if (!role && first.length <= 120) {
    const parts = first.split(/\s+(?:—|–|-|\||@|at)\s+/);
    role = parts[0].replace(/\(.*?\)/g, '').trim();
    if (!company && parts[1]) company = parts[1].replace(/\(.*?\)/g, '').trim();
  }
  if (!company) {
    const m = /\b(?:about|join|at)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})/.exec(jd);
    if (m && !/^(The|Our|Us|We)$/.test(m[1])) company = m[1];
  }
  return { role: role.slice(0, 80), company: company.slice(0, 60) };
}

function casing(term: string, ...sources: string[]): string {
  for (const s of sources) {
    const m = new RegExp(`(?<![A-Za-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}(?![A-Za-z0-9])`, 'i').exec(s);
    if (m) return m[0];
  }
  return term;
}

/* ------------------------------------------------------------ main */

export function tailor(settings: TailorSettings, job: JobInput): TailorResult {
  const warnings: string[] = [];
  const changes: string[] = [];
  const base = settings.baseTex;
  if (!/\\begin\{document\}/.test(base)) warnings.push('The base resume has no \\begin{document} — paste the full .tex file in Setup.');
  const kws = extractKeywords(job.jd, 40);
  const basePlain = documentPlain(base);
  const before = matchKeywords(basePlain, job.jd);
  const score = scorer(kws, settings.minChars, settings.maxChars);
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const bank = parseBank(settings.bulletBank);
  const usedBank = new Set<string>();
  const reports: BulletReport[] = [];
  const sections = findSections(base);
  if (!sections.length) warnings.push('No \\section{…} headings were found, so only the summary, skills and certifications rules could not run.');

  /* bullets */
  for (const sec of sections) {
    const role = sectionRole(sec.heading);
    if (!['work', 'projects', 'volunteer', 'other'].includes(role)) continue;
    if (role === 'other' && !/experience|project/i.test(sec.heading)) continue;
    for (const block of blocksIn(base, sec)) {
      const where = `${sec.heading} › ${short(block.label || 'entry', 48)}`;
      const originals = block.bullets.map((b, i) => ({ raw: b.raw, text: plainOf(b.inner), i, bank: false }));
      const group = settings.useBank ? bank.find((g) => block.full.toLowerCase().includes(g.label.toLowerCase())) : undefined;
      const extras = (group?.bullets ?? []).map((t, k) => ({ raw: '', text: t, i: 1000 + k, bank: true }));
      const pool = [...originals, ...extras].map((c) => ({ ...c, s: score(c.text) }));
      const n = originals.length;
      let chosen = pool;
      if (extras.length) chosen = pool.slice().sort((a, b) => b.s - a.s || a.i - b.i).slice(0, n);
      chosen = settings.reorderBullets ? chosen.slice().sort((a, b) => b.s - a.s || a.i - b.i) : chosen.slice().sort((a, b) => a.i - b.i);
      const kind = block.bullets[0].kind;
      const wrap = (t: string) => (kind === 'resumeItem' ? `\\resumeItem{${latexEscape(t)}}` : `\\item ${latexEscape(t)}`);
      chosen.forEach((c, k) => {
        const target = block.bullets[k];
        const text = c.bank ? wrap(c.text) : c.raw;
        if (text !== target.raw) edits.push({ start: target.start, end: target.end, text });
        reports.push({ where, text: c.text, chars: c.text.length, status: c.text.length < settings.minChars ? 'short' : c.text.length > settings.maxChars ? 'long' : 'ok', fromBank: c.bank });
      });
      const added = chosen.filter((c) => c.bank);
      const dropped = originals.filter((o) => !chosen.some((c) => !c.bank && c.i === o.i));
      const reordered = chosen.some((c, k) => !c.bank && c.i !== k);
      added.forEach((a) => usedBank.add(a.text));
      if (added.length) changes.push(`${where}: added ${added.length} bullet${added.length > 1 ? 's' : ''} from your bank — ${added.map((a) => `“${short(a.text)}”`).join(', ')}.`);
      if (dropped.length) changes.push(`${where}: left out ${dropped.map((d) => `“${short(d.text)}”`).join(', ')} (less relevant to this job).`);
      if (reordered && !added.length && !dropped.length) changes.push(`${where}: reordered bullets so the most relevant come first (“${short(chosen[0].text, 50)}”).`);
      else if (reordered) changes.push(`${where}: bullets reordered by relevance.`);
    }
  }

  /* skills */
  const skillBank = settings.skillBank
    .split(/\r?\n/)
    .map((l) => /^([^:]+):\s*(.+)$/.exec(l.trim()))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => ({ label: m[1].trim(), items: m[2].split(/\s*,\s*/).filter(Boolean) }));
  const wanted = settings.addSkills ? skillBank.flatMap((g) => g.items.filter((s) => countIn(job.jd, s) > 0 && countIn(basePlain, s) === 0).map((s) => ({ s, label: g.label }))) : [];
  const skillSecs = sections.filter((s) => sectionRole(s.heading) === 'skills');
  if (!skillSecs.length && wanted.length) warnings.push('No skills section was found, so bank skills could not be added.');
  for (const sec of skillSecs) {
    const content = base.slice(sec.contentStart, sec.end);
    const lists: Array<{ label: string; s: number; e: number; items: string[] }> = [];
    const taken = (s: number, e: number) => lists.some((l) => s < l.e && e > l.s);
    const add = (label: string, absStart: number, list: string) => {
      const items = list.split(',').map((x) => x.trim()).filter(Boolean);
      const lead = list.length - list.trimStart().length;
      const trail = list.length - list.trimEnd().length;
      const s = absStart + lead;
      const e = absStart + list.length - trail;
      if (items.length && !taken(s, e)) lists.push({ label: plainOf(label).replace(/:$/, ''), s, e, items });
    };
    for (const m of content.matchAll(/\\textbf\{([^{}]+)\}\s*\{:\s*([^{}]*)\}/g)) add(m[1], sec.contentStart + m.index! + m[0].indexOf(m[2], m[0].indexOf('{:')), m[2]);
    for (const m of content.matchAll(/\\textbf\{([^{}]+?):?\}:?[ \t]*([^{}\\\n]+)/g)) {
      const at = sec.contentStart + m.index! + m[0].length - m[2].length;
      add(m[1], at, m[2]);
    }
    for (const m of content.matchAll(/^[ \t]*([A-Za-z][\w &/-]{1,30}):[ \t]*([^\\\n{}]+)$/gm)) add(m[1], sec.contentStart + m.index! + m[0].length - m[2].length, m[2]);
    lists.sort((a, b) => a.s - b.s);
    if (!lists.length) continue;
    const pending = [...wanted];
    for (const l of lists) {
      const mine = pending.filter((w) => w.label.toLowerCase() === l.label.toLowerCase() || l.label.toLowerCase().includes(w.label.toLowerCase()));
      for (const w of mine) pending.splice(pending.indexOf(w), 1);
      if (l === lists[lists.length - 1] && pending.length) mine.push(...pending.splice(0)); // leftovers go to the last list
      let items = [...l.items, ...mine.map((w) => latexEscape(w.s))];
      if (settings.reorderSkills) {
        const rank = (x: string) => countIn(job.jd, latexUnescape(x));
        items = items.map((x, i) => ({ x, i, r: rank(x) })).sort((a, b) => (b.r > 0 ? 1 : 0) - (a.r > 0 ? 1 : 0) || b.r - a.r || a.i - b.i).map((o) => o.x);
      }
      const next = items.join(', ');
      if (next !== base.slice(l.s, l.e)) {
        edits.push({ start: l.s, end: l.e, text: next });
        const addedNames = mine.map((w) => w.s);
        changes.push(`Skills › ${l.label}: ${addedNames.length ? `added ${addedNames.join(', ')} from your skill bank; ` : ''}${settings.reorderSkills ? 'job-relevant skills moved first' : ''}.`.replace('; .', '.').replace(': .', ': updated.'));
      }
    }
  }

  /* certifications */
  const certList = settings.certs.split(/\r?\n/).map((c) => c.trim()).filter(Boolean);
  let certsUsed: string[] = [];
  if (settings.addCerts && certList.length) {
    const words = (c: string) => c.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 2 && !['certified', 'certification', 'certificate', 'professional', 'associate', 'microsoft', 'the', 'and', 'for'].includes(w));
    // A catalog entry links short names (e.g. "CKA") to the skills a job asks for (e.g. Kubernetes).
    const viaCatalog = (c: string) => CERT_CATALOG.some(([re, title]) => re.test(job.jd) && (title.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(title.toLowerCase()) || re.test(c))) ? 2 : 0;
    const scored = certList.map((c, i) => ({ c, i, s: kws.reduce((n, k) => n + (countIn(c, k.term) > 0 ? k.weight : 0), 0) + words(c).reduce((n, w) => n + (countIn(job.jd, w) > 0 ? 0.5 : 0), 0) + viaCatalog(c) }));
    const want = Math.max(1, Math.min(settings.certCount, certList.length));
    const relevant = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i);
    const fill = scored.filter((x) => x.s <= 0);
    certsUsed = [...relevant, ...fill].slice(0, Math.max(Math.min(2, want), Math.min(want, relevant.length))).map((x) => x.c);
    const enumitem = /\\usepackage(\[[^\]]*\])?\{[^}]*enumitem/.test(base);
    const block = enumitem
      ? `\n \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n     ${certsUsed.map((c) => latexEscape(c)).join(' \\\\\n     ')}\n    }}\n \\end{itemize}\n\n`
      : `\n\\begin{itemize}\n${certsUsed.map((c) => `  \\item ${latexEscape(c)}`).join('\n')}\n\\end{itemize}\n\n`;
    const certSec = sections.find((s) => sectionRole(s.heading) === 'certificates');
    if (certSec) edits.push({ start: certSec.contentStart, end: certSec.end, text: block });
    else {
      const at = base.lastIndexOf('\\end{document}');
      if (at >= 0) edits.push({ start: at, end: at, text: `\\section{Certifications}${block}` });
    }
    changes.push(`Certifications: ${certsUsed.join('; ')}${certSec ? '' : ' (new section added)'}.`);
    if (relevant.length < certsUsed.length) warnings.push(`Only ${relevant.length} of your listed certifications clearly match this job; the rest were filled from the top of your list.`);
  } else if (settings.addCerts) warnings.push('Add your certifications in Setup (one per line) so the app can pick the 2–3 that fit each job.');

  /* summary */
  const role = job.role.trim();
  if (settings.rewriteSummary && settings.summaryTemplate.trim()) {
    const sum = sections.find((s) => sectionRole(s.heading) === 'summary');
    if (sum) {
      const content = base.slice(sum.contentStart, sum.end);
      const run = /(?:[^\\{}%\n]|\\[&%$#_ ])(?:[^\\{}%]|\\[&%$#_ ]){39,}/.exec(content);
      if (run) {
        // Top job keywords that you can back up (they appear in your resume or skill bank).
        const evidence = `${basePlain} ${settings.skillBank} ${[...usedBank].join(' ')}`;
        const skillNames = [...new Set(kws.map((k) => k.term).filter((t) => t.length > 1 && countIn(evidence, t) > 0 && countIn(role, t) === 0))].slice(0, 4).map((t) => casing(t, basePlain, settings.skillBank, job.jd));
        const list = skillNames.length > 1 ? `${skillNames.slice(0, -1).join(', ')} and ${skillNames[skillNames.length - 1]}` : skillNames.join('');
        const text = settings.summaryTemplate
          .replace(/\{role\}/g, role || settings.headline || 'Professional')
          .replace(/\{company\}/g, job.company.trim() || 'your team')
          .replace(/\{years\}/g, settings.years.trim() || '3')
          .replace(/\{skills\}/g, list || 'the core skills of this role')
          .replace(/\s{2,}/g, ' ')
          .trim();
        // Never start inside a command name such as \small.
        let off = run.index;
        if (/\\[A-Za-z]*$/.test(content.slice(0, off))) off += /^[A-Za-z]*\s*/.exec(content.slice(off))![0].length;
        const start = sum.contentStart + off;
        const original = content.slice(off, run.index + run[0].length);
        const lead = original.length - original.trimStart().length;
        const trail = original.length - original.trimEnd().length;
        edits.push({ start: start + lead, end: start + original.length - trail, text: latexEscape(text) });
        changes.push(`Summary rewritten from your template: “${short(text, 110)}”`);
      } else warnings.push('The summary text could not be located for rewriting.');
    } else warnings.push('No Summary section was found, so the summary rule was skipped.');
  }

  /* headline */
  if (settings.replaceHeadline && settings.headline.trim() && role) {
    const needle = latexEscape(settings.headline.trim());
    const at = base.indexOf(needle, Math.max(0, base.indexOf('\\begin{document}')));
    if (at >= 0 && !edits.some((e) => at < e.end && at + needle.length > e.start)) {
      edits.push({ start: at, end: at + needle.length, text: latexEscape(role) });
      changes.push(`Headline changed from “${settings.headline.trim()}” to “${role}”.`);
    } else warnings.push(`The headline text “${settings.headline.trim()}” was not found in the resume body.`);
  }

  /* apply edits (non-overlapping, from the end) */
  edits.sort((a, b) => b.start - a.start);
  let tex = base;
  let floor = Infinity;
  for (const e of edits) {
    if (e.end > floor) continue; // overlapping edit: keep the later-positioned one
    tex = tex.slice(0, e.start) + e.text + tex.slice(e.end);
    floor = e.start;
  }

  const after = matchKeywords(documentPlain(tex), job.jd);
  const certSuggestions = [...new Set(CERT_CATALOG.filter(([re]) => re.test(job.jd)).map(([, c]) => c))].filter((c) => !certList.some((x) => x.toLowerCase() === c.toLowerCase())).slice(0, 5);
  if (!changes.length) changes.push('No changes were needed — your resume already fits these rules for this job.');
  const lens = reports.map((r) => r.chars);
  if (lens.length > 1 && Math.max(...lens) - Math.min(...lens) > 80) warnings.push(`Bullet lengths range from ${Math.min(...lens)} to ${Math.max(...lens)} characters. Add bank alternatives near ${settings.minChars}–${settings.maxChars} characters to even them out.`);
  return { tex, changes, before, after, bullets: reports, certsUsed, certSuggestions, warnings };
}
