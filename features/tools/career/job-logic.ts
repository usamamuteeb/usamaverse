/**
 * Plain, explainable rules for job-application helpers: keyword matching,
 * bullet-point checks, cover-letter templates, vCards and e-mail signatures.
 * No AI and no network — every result can be traced back to a rule here.
 */

/* ------------------------------------------------------------ keywords */

const STOP = new Set(
  (
    'a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each either else ever every few for from further get gets had has have having he her here hers him his how i if in into is it its itself just let like may me might more most must my no nor not now of off on once only or other our ours out over own per please same shall she should since so some such than that the their theirs them then there these they this those through thus to too under until up upon us very via was we well were what when where whether which while who whom whose why will with within without would yet you your yours ' +
    // job-posting filler
    'ability able across apply applicant applicants candidate candidates closely company day days degree desirable desired environment etc excellent experience experienced familiarity great ideal including job join key knowledge least looking new opportunity plus position preferred proven related required requirement requirements responsibilities responsible role skill skills strong successful team teams understanding using work working year years good highly level levels within wide range must-have nice-to-have bonus benefits salary we\'re you\'ll you\'re our we\'ll will be based help helping make making ensure provide support supporting various multiple other others one two three four five build builds building run runs running present presenting write writes writing create creating deliver delivering drive driving own owning use uses look looking improve improving ship shipping feature features every week weeks month months hybrid remote onsite office part full time fast quickly great ideally want wants need needs show shows across closely together alongside also'
  ).split(/\s+/),
);

/** Known multi-word skills that should stay together even if they appear once. */
const PHRASES = [
  'machine learning', 'deep learning', 'data analysis', 'data analytics', 'data science', 'data visualization', 'data engineering', 'data modeling', 'project management', 'product management', 'stakeholder management',
  'customer service', 'customer success', 'business analysis', 'business intelligence', 'power bi', 'google analytics', 'google ads', 'social media', 'content marketing', 'digital marketing', 'search engine optimization',
  'user experience', 'user interface', 'user research', 'unit testing', 'test automation', 'continuous integration', 'ci/cd', 'version control', 'rest api', 'rest apis', 'object oriented', 'design patterns', 'system design',
  'cloud computing', 'amazon web services', 'google cloud', 'microsoft azure', 'natural language processing', 'computer vision', 'financial modeling', 'financial analysis', 'supply chain', 'quality assurance', 'risk management',
  'agile methodologies', 'scrum master', 'cross-functional', 'problem solving', 'critical thinking', 'attention to detail', 'time management', 'written communication', 'verbal communication', 'team leadership', 'microsoft excel', 'microsoft office',
];

export interface Keyword {
  term: string;
  weight: number;
  count: number;
}

const TOKEN = /[a-z0-9][a-z0-9+#./-]*[a-z0-9+#]|[a-z0-9]/g;

function tokens(text: string): string[][] {
  // Split into clauses first so n-grams never cross punctuation.
  return text
    .toLowerCase()
    .replace(/[“”"()[\]{}<>]/g, ' ')
    .split(/[,;:!?\n•·|]|\.(?=\s|$)/)
    .map((clause) => (clause.match(TOKEN) ?? []).map((t) => t.replace(/\.+$/, '')).filter(Boolean));
}

const isWordy = (t: string) => !STOP.has(t) && !/^\d+[+%]?$/.test(t) && (t.length > 1 || t === 'c' || t === 'r');

/** Ranks the terms of a job description. Phrases (2–3 words) get a bonus. */
export function extractKeywords(jd: string, max = 40): Keyword[] {
  const counts = new Map<string, number>();
  const add = (k: string, n = 1) => counts.set(k, (counts.get(k) ?? 0) + n);
  for (const clause of tokens(jd)) {
    for (let i = 0; i < clause.length; i++) {
      const a = clause[i];
      if (isWordy(a) && a.length > 1) add(a);
      const b = clause[i + 1];
      if (b && isWordy(a) && isWordy(b)) add(`${a} ${b}`);
      const c = clause[i + 2];
      if (b && c && isWordy(a) && isWordy(c) && (isWordy(b) || b === 'and' || b === 'of')) add(`${a} ${b} ${c}`);
    }
  }
  // Capitalised product / tool names (e.g. "Power BI", "Google Sheets") count as real phrases.
  const capital = new Set<string>();
  for (const m of jd.matchAll(/\b([A-Z][a-zA-Z0-9+#.]*(?:\s+[A-Z][a-zA-Z0-9+#.]*){1,2})\b/g)) {
    // A capital at the start of a sentence or bullet says nothing; skip that word.
    const before = jd.slice(0, m.index).replace(/[ \t]+$/, '');
    const words = m[1].split(/\s+/);
    if (!before || /[.!?:\n•*-]$/.test(before)) words.shift();
    if (words.length < 2) continue;
    const p = words.join(' ').toLowerCase();
    if (p.split(' ').every(isWordy)) capital.add(p);
  }
  // Merge simple plurals into the singular form ("systems" → "system").
  for (const [term, count] of [...counts]) {
    const single = term.endsWith('ies') ? `${term.slice(0, -3)}y` : term.endsWith('s') && !term.endsWith('ss') ? term.slice(0, -1) : '';
    if (single && counts.has(single)) {
      counts.set(single, (counts.get(single) ?? 0) + count);
      counts.delete(term);
    }
  }
  const proper = new Set<string>();
  for (const m of jd.matchAll(/[A-Z][A-Za-z0-9+#.]+/g)) {
    const before = jd.slice(0, m.index).replace(/[ \t(]+$/, '');
    if (before && !/[.!?:\n•*-]$/.test(before)) proper.add(m[0].toLowerCase().replace(/\.+$/, ''));
  }
  const scored: Keyword[] = [];
  for (const [term, count] of counts) {
    const n = term.split(' ').length;
    const known = PHRASES.includes(term);
    const cap = capital.has(term);
    if (n > 1 && count < 2 && !known && !cap) continue; // one-off word pairs are mostly noise
    // A lowercase word used once is weak evidence; names of tools and products are strong.
    const once = n === 1 && count === 1 && !proper.has(term) && !/[+#./]/.test(term);
    const weight = Math.round((count * (n === 1 ? (once ? 0.6 : 1) : n === 2 ? 1.8 : 2.2) + (known ? 2 : 0) + (cap ? 1 : 0) + (proper.has(term) ? 0.4 : 0) + (/[+#.]/.test(term) ? 0.5 : 0)) * 10) / 10;
    scored.push({ term, weight, count });
  }
  scored.sort((x, y) => y.weight - x.weight || x.term.localeCompare(y.term));
  // Drop single words that only appear inside a chosen phrase.
  const chosen: Keyword[] = [];
  for (const k of scored) {
    if (chosen.length >= max) break;
    if (!k.term.includes(' ')) {
      const inside = chosen.filter((c) => c.term.includes(' ') && c.term.split(' ').includes(k.term));
      if (inside.length && inside.reduce((n, c) => n + c.count, 0) >= k.count) continue;
    } else if (chosen.some((c) => c.term.includes(k.term) && c.count >= k.count)) continue;
    chosen.push(k);
  }
  return chosen;
}

export function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Counts how often a keyword appears (case-insensitive, plural and dotted variants accepted). */
export function countIn(text: string, term: string): number {
  const variants = new Set([term, term.replace(/\./g, ''), term.replace(/\s+/g, '-'), term.replace(/-/g, ' ')]);
  let n = 0;
  for (const v of variants) {
    const re = new RegExp(`(?<![a-z0-9])${escapeRe(v).replace(/\\ /g, '\\s+')}(?:s|es)?(?![a-z0-9+#])`, 'gi');
    n = Math.max(n, (text.match(re) ?? []).length);
  }
  return n;
}

export interface MatchResult {
  score: number; // 0–100, weighted
  matched: Array<Keyword & { inCv: number }>;
  missing: Keyword[];
}

export function matchKeywords(cvText: string, jd: string, max = 40): MatchResult {
  const kws = extractKeywords(jd, max);
  const matched: Array<Keyword & { inCv: number }> = [];
  const missing: Keyword[] = [];
  let have = 0;
  let total = 0;
  for (const k of kws) {
    total += k.weight;
    const inCv = countIn(cvText, k.term);
    if (inCv > 0) {
      matched.push({ ...k, inCv });
      have += k.weight;
    } else missing.push(k);
  }
  return { score: total ? Math.round((have / total) * 100) : 0, matched, missing };
}

/* ------------------------------------------------------------ bullets */

export const ACTION_VERBS = (
  'accelerated accomplished achieved acquired adapted administered advised advocated allocated analyzed analysed answered anticipated applied appointed appraised approved architected arranged assembled assessed attained audited authored automated balanced benchmarked boosted briefed budgeted built calculated campaigned captured catalogued chaired championed clarified coached coded collaborated collected combined commissioned communicated compiled completed composed computed conceived conceptualized conducted configured consolidated constructed consulted contracted contributed controlled converted coordinated corrected counseled created cultivated cut debugged decreased defined delegated delivered demonstrated deployed designed detected determined developed devised diagnosed directed discovered dispatched documented doubled drafted drove earned edited educated eliminated enabled encouraged engineered enhanced established estimated evaluated examined exceeded executed expanded expedited experimented explained explored facilitated fixed forecasted formalized formed formulated founded generated grew guided halved headed identified illustrated implemented improved increased influenced informed initiated innovated inspected inspired installed instituted instructed integrated interpreted interviewed introduced invented investigated launched lectured led leveraged lowered maintained managed mapped marketed maximized measured mediated mentored merged migrated minimized modeled modelled modernized monitored motivated navigated negotiated onboarded operated optimized orchestrated organized organised originated outperformed overhauled oversaw partnered performed persuaded piloted pioneered planned prepared presented prevented prioritized processed produced programmed projected promoted proposed prototyped proved provided published qualified quantified raised ran ranked rebuilt recommended reconciled recruited redesigned reduced refactored refined regulated rehabilitated reinforced remodeled reorganized repaired replaced reported represented researched resolved restored restructured revamped reviewed revised revitalized saved scaled scheduled screened secured selected served shaped shipped simplified solved sourced spearheaded specified standardized steered streamlined strengthened structured succeeded supervised surpassed surveyed sustained synthesized systematized tailored targeted taught tested tracked trained transformed translated tripled troubleshot tutored unified upgraded utilized validated verified visualized volunteered won wrote'
).split(' ');
const VERB_SET = new Set(ACTION_VERBS);
/** Present-tense forms of irregular verbs (for current roles written in the present). */
const IRREGULAR: Record<string, string> = { lead: 'led', build: 'built', run: 'ran', write: 'wrote', drive: 'drove', grow: 'grew', teach: 'taught', oversee: 'oversaw', win: 'won', make: 'made', cut: 'cut', ship: 'shipped', plan: 'planned' };

const WEAK: Array<[RegExp, string, string]> = [
  [/^(was |were )?responsible for\b/i, 'Starts with “responsible for”', 'Say what you did: led, managed, owned, delivered'],
  [/^(i )?worked (on|with|in)\b/i, 'Starts with “worked on”', 'Try: built, developed, delivered, improved'],
  [/^(i )?helped\b/i, 'Starts with “helped”', 'Try: supported, enabled, contributed to — or the action itself'],
  [/^(i )?assisted( with| in)?\b/i, 'Starts with “assisted”', 'Name your part: coordinated, prepared, analysed'],
  [/^(i )?(participated|was involved|got involved) in\b/i, 'Starts with “participated / involved in”', 'Describe your contribution: drove, delivered, designed'],
  [/^duties (included|include)\b/i, 'Lists duties, not results', 'Rewrite as achievements: “Cut X by Y% by doing Z”'],
  [/^(tasked with|in charge of)\b/i, 'Passive opener', 'Start with the action: led, ran, owned'],
  [/^(handled|did|made|used|dealt with)\b/i, 'Vague verb', 'Prefer specific verbs: resolved, produced, implemented'],
];

const BUZZ = ['synergy', 'go-getter', 'hard-working', 'hardworking', 'team player', 'detail-oriented', 'detail oriented', 'self-starter', 'self starter', 'results-driven', 'results driven', 'think outside the box', 'dynamic', 'motivated individual', 'passionate', 'guru', 'ninja', 'rockstar', 'best of breed', 'proactive'];

export interface BulletCheck {
  text: string;
  score: number;
  words: number;
  issues: string[];
  tips: string[];
  good: string[];
}

export function checkBullet(raw: string): BulletCheck {
  const text = raw.replace(/^\s*(?:[-*+•●▪◦‣]|\d+[.)])\s*/, '').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const first = (words[0] ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const issues: string[] = [];
  const tips: string[] = [];
  const good: string[] = [];
  let score = 100;
  const weak = WEAK.find(([re]) => re.test(text));
  if (weak) {
    score -= 25;
    issues.push(weak[1]);
    tips.push(weak[2]);
  } else if (VERB_SET.has(first) || VERB_SET.has(IRREGULAR[first] ?? '') || VERB_SET.has(`${first}ed`) || VERB_SET.has(`${first}d`) || VERB_SET.has(first.replace(/y$/, 'ied')) || VERB_SET.has(`${first}${first.slice(-1)}ed`)) {
    good.push('Starts with an action verb');
  } else {
    score -= 15;
    issues.push('Does not start with an action verb');
    tips.push('Open with a past-tense verb such as led, built, reduced, launched');
  }
  if (/\d|%|\$|€|£|₹|\bpercent\b|\b(doubled|tripled|halved)\b/i.test(text)) good.push('Has a number or measurable result');
  else {
    score -= 20;
    issues.push('No number or measurable result');
    tips.push('Add scale or impact: how many, how much, how fast, % change');
  }
  if (/\b(i|me|my|mine|we|our|us)\b/i.test(text)) {
    score -= 15;
    issues.push('Uses first-person pronouns');
    tips.push('Drop “I/my/we” — CV bullets are written without them');
  }
  if (/\b(was|were|been|being|is|are|got)\s+(\w+ed|built|made|done|given|led|run|taken|written)\b/i.test(text)) {
    score -= 10;
    issues.push('Passive voice');
    tips.push('Make yourself the subject: “Reduced costs…” instead of “Costs were reduced…”');
  }
  if (words.length < 6) {
    score -= 10;
    issues.push(`Very short (${words.length} words)`);
    tips.push('Add what you did, how, and the result');
  } else if (words.length > 35) {
    score -= 10;
    issues.push(`Long (${words.length} words)`);
    tips.push('Aim for 12–30 words; split it or cut filler');
  } else good.push(`Good length (${words.length} words)`);
  const buzz = BUZZ.filter((b) => new RegExp(`\\b${escapeRe(b)}\\b`, 'i').test(text));
  if (buzz.length) {
    score -= 5 * buzz.length;
    issues.push(`Buzzword${buzz.length > 1 ? 's' : ''}: ${buzz.join(', ')}`);
    tips.push('Replace adjectives with evidence (what you achieved)');
  }
  return { text, score: Math.max(0, score), words: words.length, issues, tips, good };
}

/** Lines that look like bullet points (skips headings, dates and contact lines). */
export function bulletLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && l.split(/\s+/).length >= 3)
    .filter((l) => !/^#{1,6}\s|^[A-Z\s&]{3,}$/.test(l))
    .filter((l) => !/@|\b(19|20)\d{2}\s*[–-]\s*((19|20)\d{2}|present)\b/i.test(l) || /^\s*[-*•]/.test(l));
}

/* ------------------------------------------------------------ cover letter */

export type LetterTone = 'professional' | 'enthusiastic' | 'concise';

export interface LetterFields {
  name: string;
  email: string;
  phone: string;
  location: string;
  date: string;
  company: string;
  manager: string;
  role: string;
  source: string;
  years: string;
  skills: string;
  achievement: string;
  motivation: string;
  tone: LetterTone;
}

const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
};
const lcFirst = (s: string) => (/^I\b/.test(s) || /^[A-Z]{2,}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

function listJoin(items: string[]) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function coverLetter(f: LetterFields): string {
  const company = f.company.trim() || '[Company]';
  const role = f.role.trim() || '[Job title]';
  const manager = f.manager.trim() || 'Hiring Manager';
  const skills = f.skills.split(/\s*[,;\n]\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const skillText = skills.length ? listJoin(skills) : '[your key skills]';
  const years = f.years.trim();
  const exp = years ? `${years} year${years === '1' ? '' : 's'} of experience` : 'hands-on experience';
  const source = f.source.trim() ? ` advertised on ${f.source.trim()}` : '';
  const achievement = sentence(f.achievement) ? lcFirst(sentence(f.achievement)) : '';
  const motivation = sentence(f.motivation) ? lcFirst(sentence(f.motivation)) : '';
  const header = [f.name.trim(), [f.email.trim(), f.phone.trim()].filter(Boolean).join(' · '), f.location.trim(), '', f.date.trim()].filter((x, i) => x || i === 3);
  const greet = `Dear ${manager},`;
  let bodyParas: string[];
  let sign: string;
  if (f.tone === 'enthusiastic') {
    bodyParas = [
      `I was excited to see the ${role} opening at ${company}${source}. I bring ${exp} in ${skillText}, and the chance to put that to work for your team is exactly what I am looking for.`,
      achievement ? `One achievement I am especially proud of: ${achievement} I would love to bring the same energy and focus on results to ${company}.` : `I enjoy turning ideas into results, and I would love to bring that energy to ${company}.`,
      motivation ? `What draws me to ${company} is that ${motivation}` : `I have followed ${company}’s work with real interest and would be thrilled to contribute to what comes next.`,
      `Thank you for considering my application — I would be delighted to talk about how I can help ${company}.`,
    ];
    sign = 'Warm regards,';
  } else if (f.tone === 'concise') {
    bodyParas = [
      `I am applying for the ${role} role at ${company}${source}. I have ${exp} in ${skillText}.${achievement ? ` Most recently, ${achievement}` : ''}`,
      `${motivation ? `I am keen to join ${company} because ${motivation} ` : ''}I would welcome a short conversation about the role.`,
    ];
    sign = 'Best regards,';
  } else {
    bodyParas = [
      `I am writing to apply for the ${role} position at ${company}${source}. With ${exp} in ${skillText}, I am confident I can make a meaningful contribution to your team.`,
      achievement ? `In my recent work, ${achievement} This experience has strengthened the skills this role calls for, and I am ready to apply them at ${company}.` : `In my recent work I have built strong skills in ${skillText}, which closely match the requirements of this role.`,
      motivation ? `I am particularly interested in ${company} because ${motivation}` : `I admire ${company}’s work and would value the opportunity to contribute to it.`,
      `Thank you for your time and consideration. I would welcome the opportunity to discuss how my experience can support ${company}’s goals.`,
    ];
    sign = 'Sincerely,';
  }
  return [...header, '', greet, '', ...bodyParas.flatMap((p) => [p, '']), sign, f.name.trim() || '[Your name]', ''].join('\n');
}

/* ------------------------------------------------------------ vCard */

export interface VCardFields {
  first: string;
  last: string;
  org: string;
  title: string;
  mobile: string;
  work: string;
  email: string;
  website: string;
  street: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  birthday: string;
  note: string;
}

const vEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Folds a content line at 75 octets, as RFC 6350 asks. */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
    }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildVCard(f: VCardFields): string {
  const t = (s: string) => s.trim();
  const fn = [t(f.first), t(f.last)].filter(Boolean).join(' ') || t(f.org);
  if (!fn) throw new Error('Enter at least a name or an organisation.');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vEsc(t(f.last))};${vEsc(t(f.first))};;;`, `FN:${vEsc(fn)}`];
  if (t(f.org)) lines.push(`ORG:${vEsc(t(f.org))}`);
  if (t(f.title)) lines.push(`TITLE:${vEsc(t(f.title))}`);
  if (t(f.mobile)) lines.push(`TEL;TYPE=CELL:${vEsc(t(f.mobile))}`);
  if (t(f.work)) lines.push(`TEL;TYPE=WORK,VOICE:${vEsc(t(f.work))}`);
  if (t(f.email)) lines.push(`EMAIL;TYPE=INTERNET:${vEsc(t(f.email))}`);
  if (t(f.website)) lines.push(`URL:${vEsc(/^https?:/i.test(t(f.website)) ? t(f.website) : `https://${t(f.website)}`)}`);
  if ([f.street, f.city, f.region, f.postcode, f.country].some((x) => t(x))) lines.push(`ADR;TYPE=WORK:;;${[f.street, f.city, f.region, f.postcode, f.country].map((x) => vEsc(t(x))).join(';')}`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t(f.birthday))) lines.push(`BDAY:${t(f.birthday)}`);
  if (t(f.note)) lines.push(`NOTE:${vEsc(t(f.note))}`);
  lines.push('END:VCARD');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------ e-mail signature */

export interface SignatureFields {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  linkedin: string;
  address: string;
  accent: string;
  font: string;
  layout: 'divider' | 'stacked' | 'compact';
}

const he = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const href = (s: string) => (/^https?:\/\//i.test(s.trim()) ? s.trim() : `https://${s.trim().replace(/^\/+/, '')}`);
const show = (s: string) => s.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');

/** Table-based, inline-styled HTML that survives Gmail, Outlook and Apple Mail. */
export function signatureHtml(f: SignatureFields): string {
  const color = /^#[0-9a-f]{6}$/i.test(f.accent) ? f.accent : '#b3263e';
  const font = he(f.font || 'Arial, Helvetica, sans-serif');
  const base = `font-family:${font};font-size:13px;line-height:1.45;color:#333333;`;
  const link = (url: string, text: string) => `<a href="${he(url)}" style="color:${color};text-decoration:none;">${he(text)}</a>`;
  const contacts: string[] = [];
  if (f.phone.trim()) contacts.push(link(`tel:${f.phone.replace(/[^\d+]/g, '')}`, f.phone.trim()));
  if (f.email.trim()) contacts.push(link(`mailto:${f.email.trim()}`, f.email.trim()));
  if (f.website.trim()) contacts.push(link(href(f.website), show(f.website)));
  if (f.linkedin.trim()) contacts.push(link(href(f.linkedin), 'LinkedIn'));
  const nameLine = `<strong style="font-size:15px;color:#111111;">${he(f.name.trim() || 'Your Name')}</strong>`;
  const roleLine = [f.title.trim(), f.company.trim()].filter(Boolean).map(he).join(' · ');
  const addr = f.address.trim() ? `<span style="color:#777777;">${he(f.address.trim())}</span>` : '';
  if (f.layout === 'compact') {
    return `<table cellpadding="0" cellspacing="0" border="0" style="${base}"><tr><td>${nameLine}${roleLine ? ` <span style="color:#777777;">|</span> ${roleLine}` : ''}<br>${contacts.join(' <span style="color:#bbbbbb;">|</span> ')}${addr ? `<br>${addr}` : ''}</td></tr></table>`;
  }
  if (f.layout === 'stacked') {
    return `<table cellpadding="0" cellspacing="0" border="0" style="${base}"><tr><td>${nameLine}${roleLine ? `<br><span style="color:${color};">${roleLine}</span>` : ''}</td></tr><tr><td style="padding-top:6px;">${contacts.join('<br>')}${addr ? `<br>${addr}` : ''}</td></tr></table>`;
  }
  return `<table cellpadding="0" cellspacing="0" border="0" style="${base}"><tr><td style="padding-right:14px;border-right:3px solid ${color};vertical-align:top;">${nameLine}${roleLine ? `<br><span style="color:#555555;">${roleLine}</span>` : ''}</td><td style="padding-left:14px;vertical-align:top;">${contacts.join('<br>')}${addr ? `<br>${addr}` : ''}</td></tr></table>`;
}

export function signatureText(f: SignatureFields): string {
  return [
    f.name.trim() || 'Your Name',
    [f.title.trim(), f.company.trim()].filter(Boolean).join(' · '),
    [f.phone.trim(), f.email.trim()].filter(Boolean).join(' | '),
    [f.website.trim() && show(f.website), f.linkedin.trim() && show(f.linkedin)].filter(Boolean).join(' | '),
    f.address.trim(),
  ]
    .filter(Boolean)
    .join('\n');
}
