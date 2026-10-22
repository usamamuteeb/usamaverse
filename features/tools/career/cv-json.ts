/**
 * CV ⇄ JSON Resume (https://jsonresume.org/schema, v1). JSON Resume has fixed
 * section types, so sections it cannot express are kept under
 * meta.additionalSections and restored when the file is read back here.
 */
import { cleanCv, displayUrl, emptyBasics, emptyEntry, newSection, sectionRole, toUrl, type CvData, type CvEntry, type CvSection } from './cv-model';

type J = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const arr = (v: unknown): J[] => (Array.isArray(v) ? v.filter((x): x is J => Boolean(x) && typeof x === 'object') : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);

const DEGREE = /^(Bachelor(?:'?s)?(?: of [A-Z][\w]*(?: (?!in\b)[A-Z][\w]*)?)?|Master(?:'?s)?(?: of [A-Z][\w]*(?: (?!in\b)[A-Z][\w]*)?)?|Doctor(?:ate)?(?: of [A-Z][\w]*)?|Associate(?: of [A-Z][\w]*)?|B\.?\s?S\.?c?|B\.?\s?A\.?|B\.?\s?E\.?(?:ng)?|B\.?\s?Tech|BBA|BCom|LLB|M\.?\s?S\.?c?|M\.?\s?A\.?|M\.?\s?E\.?(?:ng)?|M\.?\s?Tech|MBA|MPhil|LLM|Ph\.?\s?D\.?|MD|A[- ]?Levels?|O[- ]?Levels?|HSSC|SSC|F\.?Sc|Matric(?:ulation)?|High School Diploma|GED)\.?\s*(?:in\s+|,\s*|-\s+)?(.*)$/i;

export function splitDegree(title: string): { studyType: string; area: string } {
  const m = DEGREE.exec(title.trim());
  if (!m) return { studyType: '', area: title.trim() };
  return { studyType: m[1].trim(), area: m[2].trim() };
}

function profile(network: string, value: string) {
  const url = toUrl(value);
  const username = displayUrl(value).split('/').filter(Boolean).pop() ?? '';
  return { network, username, url };
}

function parseLanguage(item: string) {
  const m = /^(.+?)\s*[(:–-]\s*([^)]*)\)?$/.exec(item);
  return m ? { language: m[1].trim(), fluency: m[2].trim() } : { language: item.trim(), fluency: '' };
}

export function cvToJsonResume(input: CvData): J {
  const cv = cleanCv(input);
  const b = cv.basics;
  const profiles = [b.linkedin && profile('LinkedIn', b.linkedin), b.github && profile('GitHub', b.github)].filter(Boolean);
  const out: J = {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: b.name,
      label: b.label,
      email: b.email,
      phone: b.phone,
      url: b.website ? toUrl(b.website) : '',
      summary: b.summary,
      location: b.location ? { address: b.location } : {},
      profiles,
    },
  };
  const push = (key: string, v: J) => {
    (out[key] as J[] | undefined) ? (out[key] as J[]).push(v) : (out[key] = [v]);
  };
  const extra: J[] = [];
  for (const sec of cv.sections) {
    const role = sectionRole(sec.heading);
    if (sec.kind === 'skills') {
      for (const g of sec.skills) push('skills', { name: g.name, keywords: g.items.split(/\s*[,;]\s*/).filter(Boolean) });
      continue;
    }
    if (sec.kind === 'list') {
      if (role === 'skills') for (const i of sec.items) push('skills', { name: i, keywords: [] });
      else if (role === 'languages') for (const i of sec.items) push('languages', parseLanguage(i));
      else if (role === 'interests') for (const i of sec.items) push('interests', { name: i });
      else if (role === 'certificates') for (const i of sec.items) push('certificates', { name: i });
      else if (role === 'awards') for (const i of sec.items) push('awards', { title: i });
      else if (role === 'references') for (const i of sec.items) push('references', { name: '', reference: i });
      else extra.push(plainSection(sec));
      continue;
    }
    if (sec.kind === 'text') {
      if (role === 'summary' && !b.summary) (out.basics as J).summary = sec.text;
      else extra.push(plainSection(sec));
      continue;
    }
    for (const e of sec.entries) {
      const dates = { startDate: e.start, endDate: e.end };
      switch (role) {
        case 'education': {
          const { studyType, area } = splitDegree(e.title);
          push('education', { institution: e.org, area, studyType, location: e.location, ...dates, score: e.details, url: e.url ? toUrl(e.url) : '', courses: e.bullets });
          break;
        }
        case 'projects':
          push('projects', { name: e.title, description: e.details, highlights: e.bullets, keywords: e.org.split(/\s*,\s*/).filter(Boolean), url: e.url ? toUrl(e.url) : '', ...dates });
          break;
        case 'volunteer':
          push('volunteer', { organization: e.org, position: e.title, url: e.url ? toUrl(e.url) : '', ...dates, summary: e.details, highlights: e.bullets });
          break;
        case 'publications':
          push('publications', { name: e.title, publisher: e.org, releaseDate: e.end || e.start, url: e.url ? toUrl(e.url) : '', summary: [e.details, ...e.bullets].filter(Boolean).join(' ') });
          break;
        case 'awards':
          push('awards', { title: e.title, awarder: e.org, date: e.end || e.start, summary: [e.details, ...e.bullets].filter(Boolean).join(' ') });
          break;
        case 'certificates':
          push('certificates', { name: e.title, issuer: e.org, date: e.end || e.start, url: e.url ? toUrl(e.url) : '' });
          break;
        case 'work':
          push('work', { name: e.org, position: e.title, location: e.location, url: e.url ? toUrl(e.url) : '', ...dates, summary: e.details, highlights: e.bullets });
          break;
        default:
          break;
      }
    }
    if (!['education', 'projects', 'volunteer', 'publications', 'awards', 'certificates', 'work'].includes(role)) extra.push(plainSection(sec));
  }
  if (extra.length) out.meta = { additionalSections: extra };
  return out;
}

function plainSection(sec: CvSection): J {
  return { heading: sec.heading, kind: sec.kind, entries: sec.entries, skills: sec.skills, items: sec.items, text: sec.text };
}

function entry(p: Partial<CvEntry>): CvEntry {
  return { ...emptyEntry(), ...p, url: p.url ? displayUrl(p.url) : '', bullets: (p.bullets ?? []).filter(Boolean) };
}

/** Reads JSON Resume — or this site's own CV JSON (with a "sections" array). */
export function jsonToCv(text: string): CvData {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch (e) {
    throw new Error(`That is not valid JSON (${e instanceof Error ? e.message : String(e)}).`);
  }
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('Expected a JSON object with a "basics" field.');
  const o = j as J;
  if (Array.isArray(o.sections) && o.basics && typeof o.basics === 'object') {
    // Our own format: trust the shape but normalise every field.
    const basics = { ...emptyBasics(), ...Object.fromEntries(Object.entries(o.basics as J).map(([k, v]) => [k, s(v)])) };
    const sections = arr(o.sections).map((x) => restoreSection(x));
    return { basics, sections };
  }
  const bj = (o.basics ?? {}) as J;
  const basics = emptyBasics();
  basics.name = s(bj.name);
  basics.label = s(bj.label);
  basics.email = s(bj.email);
  basics.phone = s(bj.phone);
  basics.website = s(bj.url) || s(bj.website);
  basics.summary = s(bj.summary);
  const loc = (bj.location ?? {}) as J;
  basics.location = typeof bj.location === 'string' ? bj.location : [s(loc.address), s(loc.city), s(loc.region), s(loc.countryCode)].filter(Boolean).join(', ');
  for (const p of arr(bj.profiles)) {
    const net = s(p.network).toLowerCase();
    const url = s(p.url) || (net.includes('github') ? `github.com/${s(p.username)}` : net.includes('linkedin') ? `linkedin.com/in/${s(p.username)}` : '');
    if (net.includes('linkedin')) basics.linkedin ||= displayUrl(url);
    else if (net.includes('github')) basics.github ||= displayUrl(url);
    else if (!basics.website && url) basics.website = displayUrl(url);
  }
  if (basics.website) basics.website = displayUrl(basics.website);

  const sections: CvSection[] = [];
  const add = (heading: string, kind: CvSection['kind'], fill: (sec: CvSection) => void) => {
    const sec = newSection(heading, kind);
    fill(sec);
    sections.push(sec);
  };
  const work = arr(o.work);
  if (work.length)
    add('Experience', 'entries', (sec) => {
      sec.entries = work.map((w) => entry({ title: s(w.position), org: s(w.name) || s(w.company), location: s(w.location), start: s(w.startDate), end: s(w.endDate) || (s(w.startDate) ? 'Present' : ''), details: s(w.summary) || s(w.description), url: s(w.url), bullets: strs(w.highlights) }));
    });
  const edu = arr(o.education);
  if (edu.length)
    add('Education', 'entries', (sec) => {
      sec.entries = edu.map((e) => entry({ title: [s(e.studyType), s(e.area)].filter(Boolean).join(' '), org: s(e.institution), location: s(e.location), start: s(e.startDate), end: s(e.endDate), details: s(e.score) || s(e.gpa), url: s(e.url), bullets: strs(e.courses) }));
    });
  const projects = arr(o.projects);
  if (projects.length)
    add('Projects', 'entries', (sec) => {
      sec.entries = projects.map((p) => entry({ title: s(p.name), org: strs(p.keywords).join(', '), start: s(p.startDate), end: s(p.endDate), details: s(p.description), url: s(p.url), bullets: strs(p.highlights) }));
    });
  const skills = arr(o.skills);
  if (skills.length)
    add('Skills', 'skills', (sec) => {
      sec.skills = skills.map((k) => ({ name: s(k.name), items: strs(k.keywords).join(', ') || s(k.level) }));
    });
  const certs = arr(o.certificates);
  if (certs.length)
    add('Certifications', 'entries', (sec) => {
      sec.entries = certs.map((c) => entry({ title: s(c.name), org: s(c.issuer), end: s(c.date), url: s(c.url) }));
    });
  const awards = arr(o.awards);
  if (awards.length)
    add('Awards', 'entries', (sec) => {
      sec.entries = awards.map((a) => entry({ title: s(a.title), org: s(a.awarder), end: s(a.date), details: s(a.summary) }));
    });
  const pubs = arr(o.publications);
  if (pubs.length)
    add('Publications', 'entries', (sec) => {
      sec.entries = pubs.map((p) => entry({ title: s(p.name), org: s(p.publisher), end: s(p.releaseDate), url: s(p.url), details: s(p.summary) }));
    });
  const vol = arr(o.volunteer);
  if (vol.length)
    add('Volunteering', 'entries', (sec) => {
      sec.entries = vol.map((v) => entry({ title: s(v.position), org: s(v.organization), start: s(v.startDate), end: s(v.endDate), details: s(v.summary), url: s(v.url), bullets: strs(v.highlights) }));
    });
  const langs = arr(o.languages);
  if (langs.length)
    add('Languages', 'list', (sec) => {
      sec.items = langs.map((l) => (s(l.fluency) ? `${s(l.language)} (${s(l.fluency)})` : s(l.language))).filter(Boolean);
    });
  const interests = arr(o.interests);
  if (interests.length)
    add('Interests', 'list', (sec) => {
      sec.items = interests.map((i) => [s(i.name), strs(i.keywords).join(', ')].filter(Boolean).join(': '));
    });
  const refs = arr(o.references);
  if (refs.length)
    add('References', 'list', (sec) => {
      sec.items = refs.map((r) => [s(r.reference), s(r.name) && `— ${s(r.name)}`].filter(Boolean).join(' '));
    });
  for (const x of arr((o.meta as J | undefined)?.additionalSections)) sections.push(restoreSection(x));
  return { basics, sections };
}

function restoreSection(x: J): CvSection {
  const kind = (['entries', 'skills', 'list', 'text'] as const).find((k) => k === x.kind) ?? 'entries';
  const sec = newSection(s(x.heading) || 'Section', kind);
  sec.entries = arr(x.entries).map((e) => entry({ title: s(e.title), org: s(e.org), location: s(e.location), start: s(e.start), end: s(e.end), details: s(e.details), url: s(e.url), bullets: strs(e.bullets) }));
  sec.skills = arr(x.skills).map((g) => ({ name: s(g.name), items: s(g.items) }));
  sec.items = strs(x.items);
  sec.text = s(x.text);
  return sec;
}
