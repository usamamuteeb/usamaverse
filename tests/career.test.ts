import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVCard, checkBullet, countIn, coverLetter, extractKeywords, matchKeywords, signatureHtml, signatureText } from '@/features/tools/career/job-logic';

const JD = `We are hiring a Data Analyst in Karachi.
- Build dashboards in Power BI and Excel for sales stakeholders.
- Write SQL queries; automate reports with Python.
Requirements: 2+ years in data analysis, strong SQL and Python, Power BI or Tableau. Google Analytics is a plus.`;

test('keywords favour repeated terms, known phrases and product names', () => {
  const terms = extractKeywords(JD, 15).map((k) => k.term);
  for (const t of ['power bi', 'sql', 'python', 'data analysis', 'google analytics']) assert.ok(terms.includes(t), `${t} in ${terms.join(', ')}`);
  assert.ok(!terms.includes('2+'));
  assert.ok(!terms.includes('write sql'));
  assert.ok(!terms.includes('requirements'));
});

test('keyword matching accepts plural and dotted variants', () => {
  assert.equal(countIn('Built dashboards with Node.js and nodejs', 'node.js'), 1);
  assert.equal(countIn('Created 3 dashboards', 'dashboard'), 1);
  assert.equal(countIn('C++ and C#', 'c++'), 1);
  const r = matchKeywords('Analyst using SQL, Python and Tableau', JD, 20);
  assert.ok(r.matched.some((m) => m.term === 'sql'));
  assert.ok(r.missing.some((m) => m.term === 'power bi'));
  assert.ok(r.score > 0 && r.score < 100);
});

test('bullet checks reward verbs and numbers, flag weak phrasing', () => {
  assert.equal(checkBullet('Led a team of 5 to rebuild checkout, lifting conversion by 12%').score, 100);
  const weak = checkBullet('- I was responsible for the website');
  assert.ok(weak.issues.some((i) => /first-person/.test(i)));
  assert.ok(weak.score < 60);
  assert.ok(checkBullet('Reports were created weekly for managers to read').issues.includes('Passive voice'));
  assert.ok(checkBullet('Manage payroll for 200 staff across 3 countries').good.includes('Starts with an action verb'));
});

test('cover letter fills every tone without placeholders when data is given', () => {
  const base = { name: 'Ali', email: 'a@b.co', phone: '', location: '', date: '1 May 2026', company: 'Acme', manager: '', role: 'Analyst', source: '', years: '3', skills: 'SQL, Python', achievement: 'I cut reporting time by 40%', motivation: '', tone: 'professional' as const };
  for (const tone of ['professional', 'enthusiastic', 'concise'] as const) {
    const l = coverLetter({ ...base, tone });
    assert.ok(l.includes('Dear Hiring Manager,'));
    assert.ok(l.includes('Analyst') && l.includes('Acme'));
    assert.ok(!l.includes('[Company]'));
    assert.ok(/I cut reporting time by 40%\./.test(l));
  }
  assert.ok(coverLetter({ ...base, company: '' }).includes('[Company]'));
});

test('vCard escapes and folds lines', () => {
  const v = buildVCard({ first: 'Ali', last: 'Raza', org: 'Acme; Inc', title: '', mobile: '+92 300 1234567', work: '', email: 'ali@x.io', website: 'ali.dev', street: '', city: 'Karachi', region: '', postcode: '', country: 'PK', birthday: '1990-01-31', note: 'x'.repeat(120) });
  assert.match(v, /^BEGIN:VCARD\r\nVERSION:3.0\r\nN:Raza;Ali;;;\r\nFN:Ali Raza\r\n/);
  assert.ok(v.includes('ORG:Acme\\; Inc'));
  assert.ok(v.includes('URL:https://ali.dev'));
  assert.ok(v.includes('BDAY:1990-01-31'));
  for (const line of v.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.throws(() => buildVCard({ first: '', last: '', org: '', title: '', mobile: '', work: '', email: '', website: '', street: '', city: '', region: '', postcode: '', country: '', birthday: '', note: '' }));
});

test('email signature HTML is escaped and links are safe', () => {
  const f = { name: '<b>x</b>', title: 'Dev', company: 'A&B', phone: '+1 555', email: 'a@b.co', website: 'javascript:alert(1)', linkedin: '', address: '', accent: 'red;" onclick="x', font: 'Arial', layout: 'divider' as const };
  const html = signatureHtml(f);
  assert.ok(!html.includes('<b>x</b>') && html.includes('&lt;b&gt;'));
  assert.ok(html.includes('A&amp;B'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes('onclick'));
  assert.match(signatureText(f), /Dev · A&B/);
});
