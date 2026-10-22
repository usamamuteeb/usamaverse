import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectJob, findSections, parseBank, tailor } from '@/features/apps/resume-tailor/engine';
import { defaultSettings, normaliseSettings } from '@/features/apps/resume-tailor/storage';
import { EXAMPLE_JD } from '@/features/apps/resume-tailor/defaults';

const job = () => ({ jd: EXAMPLE_JD, ...detectJob(EXAMPLE_JD) });

test('job title and company are read from the posting', () => {
  assert.deepEqual(detectJob(EXAMPLE_JD), { role: 'Senior Data Analyst', company: 'Lumen Commerce' });
  assert.deepEqual(detectJob('Job title: QA Engineer\nCompany: Acme Ltd\nWe test things.'), { role: 'QA Engineer', company: 'Acme Ltd' });
});

test('tailoring raises the match score and keeps the document valid', () => {
  const r = tailor(defaultSettings(), job());
  assert.ok(r.after.score > r.before.score, `${r.before.score} -> ${r.after.score}`);
  assert.match(r.tex, /^\\documentclass[\s\S]*\\begin\{document\}[\s\S]*\\end\{document\}\s*$/);
  // braces stay balanced after all edits
  let depth = 0;
  for (const ch of r.tex.replace(/\\[{}]/g, '')) depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
  assert.equal(depth, 0);
  // same number of bullets per employer as the base resume
  assert.equal((r.tex.match(/\\resumeItem\{/g) ?? []).length, (defaultSettings().baseTex.match(/\\resumeItem\{/g) ?? []).length);
  assert.ok(r.tex.includes('Snowflake data mart'), 'bank bullet that matches the job is used');
  assert.ok(/Tools\}\{: Snowflake, BigQuery/.test(r.tex), 'matching bank skills are added first');
});

test('certifications: 2–3 relevant plain titles, never labelled as targets', () => {
  const r = tailor(defaultSettings(), job());
  assert.ok(r.certsUsed.length >= 2 && r.certsUsed.length <= 3);
  assert.ok(r.certsUsed.some((c) => /Power BI|Snowflake/.test(c)));
  const certSection = r.tex.slice(r.tex.indexOf('\\section{Certifications}'));
  assert.ok(!/target/i.test(certSection));
  const two = tailor({ ...defaultSettings(), certCount: 2 }, job());
  assert.equal(two.certsUsed.length, 2);
});

test('bullets in the target length range are preferred and reported', () => {
  const r = tailor(defaultSettings(), job());
  assert.ok(r.bullets.length >= 8);
  assert.ok(r.bullets.every((b) => b.status === 'ok'), JSON.stringify(r.bullets.map((b) => b.chars)));
});

test('summary and headline follow the settings', () => {
  const r = tailor(defaultSettings(), job());
  assert.match(r.tex, /\{\\small Senior Data Analyst with 4\+ years of experience in /);
  assert.match(r.tex, /\\small Senior Data Analyst \$\|\$/);
  const off = tailor({ ...defaultSettings(), rewriteSummary: false, replaceHeadline: false, useBank: false, addSkills: false, addCerts: false, reorderSkills: false, reorderBullets: false }, job());
  assert.equal(off.tex, defaultSettings().baseTex);
});

test('works on third-party templates without breaking them', () => {
  for (const f of ['jake.tex', 'moderncv.tex', 'awesome.tex']) {
    const base = readFileSync(new URL(`./fixtures/cv/${f}`, import.meta.url), 'utf8');
    const r = tailor({ ...defaultSettings(), baseTex: base, certs: 'AWS Certified Cloud Practitioner', headline: '' }, { jd: 'Python developer with Docker and SQL', role: 'Python Developer', company: 'Acme' });
    let depth = 0;
    for (const ch of r.tex.replace(/\\[{}]/g, '')) depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
    assert.equal(depth, 0, f);
    assert.ok(r.tex.includes('\\end{document}'), f);
    assert.ok(findSections(r.tex).length >= 2, f);
  }
});

test('bank parsing and settings normalisation', () => {
  assert.deepEqual(parseBank('[Acme]\n- one\n* two\n\n## Beta\n• three'), [{ label: 'Acme', bullets: ['one', 'two'] }, { label: 'Beta', bullets: ['three'] }]);
  const s = normaliseSettings({ certCount: 99, minChars: 'x', baseTex: 'abc', unknown: 1 });
  assert.equal(s.certCount, 5);
  assert.equal(s.baseTex, 'abc');
  assert.equal(s.minChars, defaultSettings().minChars);
});
