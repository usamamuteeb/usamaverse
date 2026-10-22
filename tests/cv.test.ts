import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sampleCv, extractDateRange, absorbContacts, emptyBasics, type CvData } from '@/features/tools/career/cv-model';
import { cvToLatex } from '@/features/tools/career/cv-latex';
import { parseCv, writeCv } from '@/features/tools/career/cv-convert';
import { splitDegree } from '@/features/tools/career/cv-json';
import { latexEscape, latexUnescape } from '@/features/tools/latex/escape';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/cv/${name}`, import.meta.url), 'utf8');
const strip = (cv: CvData) => JSON.parse(JSON.stringify(cv, (k, v) => (k === 'id' ? undefined : v)));
const base = () => strip(parseCv(writeCv(sampleCv(), 'cvjson'), 'json').cv);

test('CV survives a round trip through every text format', () => {
  for (const f of ['markdown', 'text', 'json', 'cvjson'] as const) {
    assert.deepEqual(strip(parseCv(writeCv(sampleCv(), f), f === 'cvjson' ? 'json' : f).cv), base(), f);
  }
});

test('CV survives a round trip through every LaTeX template', () => {
  for (const template of ['classic', 'compact', 'moderncv'] as const) {
    const tex = cvToLatex(sampleCv(), { template });
    assert.match(tex, /\\begin\{document\}[\s\S]*\\end\{document\}/);
    assert.deepEqual(strip(parseCv(tex, 'latex').cv), base(), template);
  }
});

test('LaTeX output escapes special characters', () => {
  const cv = sampleCv();
  cv.sections[0].entries[0].bullets = ['100% & #1 with C# and $5k_budget ~ ^ {x} \\ <a> | b'];
  const tex = cvToLatex(cv, { template: 'classic' });
  assert.ok(tex.includes('100\\% \\& \\#1 with C\\# and \\$5k\\_budget \\textasciitilde{} \\textasciicircum{} \\{x\\} \\textbackslash{} \\textless{}a\\textgreater{} \\textbar{} b'));
  assert.equal(latexUnescape(latexEscape('a_b & 50% {c} ~ ^ \\')), 'a_b & 50% {c} ~ ^ \\');
});

test('reads a Jake-style LaTeX resume', () => {
  const { cv } = parseCv(fixture('jake.tex'));
  assert.equal(cv.basics.name, 'Omar Siddiqui');
  assert.equal(cv.basics.email, 'omar@example.com');
  assert.equal(cv.basics.phone, '555-012-3456');
  assert.equal(cv.basics.github, 'github.com/omarsid');
  assert.deepEqual(cv.sections.map((s) => [s.heading, s.kind]), [['Education', 'entries'], ['Experience', 'entries'], ['Projects', 'entries'], ['Technical Skills', 'skills']]);
  const [edu] = cv.sections[0].entries;
  assert.equal(edu.org, 'Northfield University');
  assert.equal(edu.title, 'Bachelor of Science in Computer Science, Minor in Business');
  assert.deepEqual([edu.start, edu.end], ['Aug. 2018', 'May 2021']);
  const job = cv.sections[1].entries[0];
  assert.deepEqual([job.title, job.org, job.location, job.end], ['Undergraduate Research Assistant', 'Northfield University', 'Austin, TX', 'Present']);
  assert.equal(job.bullets.length, 2);
  assert.ok(job.bullets[1].includes('classroom setting & reported'));
  assert.deepEqual([cv.sections[2].entries[0].title, cv.sections[2].entries[0].org], ['Gitlytics', 'Python, Flask, React, PostgreSQL, Docker']);
  assert.deepEqual(cv.sections[3].skills.map((g) => g.name), ['Languages', 'Frameworks', 'Developer Tools']);
});

test('reads moderncv and awesome-cv documents', () => {
  const m = parseCv(fixture('moderncv.tex')).cv;
  assert.equal(m.basics.name, 'Sara Martínez');
  assert.equal(m.basics.label, 'Data Analyst');
  assert.equal(m.basics.phone, '+34 600 123 456');
  assert.equal(m.basics.location, 'Calle Mayor 1, Madrid, Spain');
  assert.equal(m.basics.linkedin, 'linkedin.com/in/saramartinez');
  const edu = m.sections.find((s) => s.heading === 'Education')!.entries[0];
  assert.deepEqual([edu.title, edu.org, edu.start, edu.end], ['BSc Statistics', 'Universidad Complutense', '2014', '2018']);
  const job = m.sections.find((s) => s.heading === 'Experience')!.entries.find((e) => e.title === 'Data Analyst')!;
  assert.equal(job.bullets.length, 2);
  assert.deepEqual(m.sections.find((s) => s.heading === 'Interests')!.items, ['Chess', 'Hiking']);

  const a = parseCv(fixture('awesome.tex')).cv;
  assert.equal(a.basics.name, 'Lena Fischer');
  assert.equal(a.basics.github, 'github.com/lenafischer');
  const sre = a.sections[0].entries[0];
  assert.deepEqual([sre.title, sre.org, sre.location, sre.start, sre.end], ['Site Reliability Engineer', 'Harbor Cloud GmbH', 'Hamburg, Germany', 'Jan. 2021', 'Present']);
  assert.deepEqual(a.sections[1].skills, [{ name: 'DevOps', items: 'Kubernetes, Terraform, ArgoCD' }, { name: 'Languages', items: 'Go, Python, Bash' }]);
});

test('reads a plain-text CV copied from a PDF', () => {
  const { cv, format } = parseCv(fixture('plain.txt'));
  assert.equal(format, 'text');
  assert.equal(cv.basics.name, 'John Doe');
  assert.equal(cv.basics.label, 'Mechanical Engineer');
  assert.equal(cv.basics.location, 'Karachi, Pakistan');
  assert.equal(cv.basics.linkedin, 'linkedin.com/in/johndoe');
  assert.match(cv.basics.summary, /HVAC design/);
  const work = cv.sections.find((s) => s.heading === 'Work Experience')!;
  assert.equal(work.entries.length, 2);
  assert.deepEqual([work.entries[0].title, work.entries[0].org, work.entries[0].start, work.entries[0].end], ['Senior HVAC Engineer', 'Coolair Systems', 'Jan 2021', 'Present']);
  assert.equal(work.entries[1].bullets.length, 1);
  assert.deepEqual(cv.sections.find((s) => s.heading === 'Languages')!.items, ['English', 'Urdu']);
});

test('date ranges, contacts and degrees are recognised', () => {
  assert.deepEqual(extractDateRange('Engineer — Acme · Jan 2020 – Present'), { start: 'Jan 2020', end: 'Present', rest: 'Engineer — Acme' });
  assert.deepEqual(extractDateRange('2018 - 2022')!.end, '2022');
  assert.equal(extractDateRange('Built 2 apps'), null);
  const b = emptyBasics();
  const rest = absorbContacts('jo@x.io | +1 (555) 010-2000 | Paris, France | jo.dev | github.com/jo | Open to work', b);
  assert.deepEqual([b.email, b.phone, b.location, b.website, b.github], ['jo@x.io', '+1 (555) 010-2000', 'Paris, France', 'jo.dev', 'github.com/jo']);
  assert.deepEqual(rest, ['Open to work']);
  assert.deepEqual(splitDegree('BSc Computer Science'), { studyType: 'BSc', area: 'Computer Science' });
  assert.deepEqual(splitDegree('Master of Science in Data Science'), { studyType: 'Master of Science', area: 'Data Science' });
});

test('JSON Resume input is read, and bad JSON gives a clear error', () => {
  const { cv } = parseCv(JSON.stringify({ basics: { name: 'Ali', profiles: [{ network: 'GitHub', username: 'ali' }] }, work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01', highlights: ['Did things'] }], languages: [{ language: 'Urdu', fluency: 'Native' }] }));
  assert.equal(cv.basics.github, 'github.com/ali');
  assert.deepEqual([cv.sections[0].entries[0].title, cv.sections[0].entries[0].org, cv.sections[0].entries[0].end], ['Dev', 'Acme', 'Present']);
  assert.deepEqual(cv.sections[1].items, ['Urdu (Native)']);
  assert.throws(() => parseCv('{ nope', 'json'), /not valid JSON/);
});

test('HTML export escapes content', () => {
  const cv = sampleCv();
  cv.basics.name = '<script>alert(1)</script>';
  const html = writeCv(cv, 'html');
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;'));
});
