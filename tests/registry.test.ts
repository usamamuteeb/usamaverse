import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '@/lib/tools/registry';
import { categories } from '@/lib/tools/categories';
import { publicTools, publicSearchItems, categoriesWithCounts, relatedTools } from '@/lib/tools/public';
import { loaders } from '@/lib/tools/loader-map';
import { buildIndex, search, normalize } from '@/lib/tools/search';

test('slugs and ids are unique and URL-safe', () => {
  const slugs = registry.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length, `duplicate slugs: ${slugs.filter((s, i) => slugs.indexOf(s) !== i)}`);
  assert.equal(new Set(registry.map((t) => t.id)).size, registry.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test('every tool has a valid category', () => {
  const valid = new Set(categories.map((c) => c.slug));
  for (const t of registry) assert.ok(valid.has(t.category), `${t.slug} has unknown category ${t.category}`);
});

test('related references exist; public tools only relate to public tools', () => {
  const all = new Set(registry.map((t) => t.slug));
  const pub = new Set(publicTools.map((t) => t.slug));
  for (const t of registry) {
    for (const r of t.related) {
      assert.ok(all.has(r), `${t.slug} → missing related ${r}`);
      assert.notEqual(r, t.slug);
      if (t.status === 'implemented') assert.ok(pub.has(r), `${t.slug} relates to non-public ${r}`);
    }
  }
});

test('implemented tools and loader map match exactly', () => {
  const impl = publicTools.map((t) => t.slug).sort();
  assert.deepEqual(Object.keys(loaders).sort(), impl);
});

test('public surfaces contain implemented tools only, with honest counts', () => {
  assert.ok(publicTools.every((t) => t.status === 'implemented'));
  assert.equal(publicSearchItems.length, publicTools.length);
  const total = categoriesWithCounts().reduce((n, c) => n + c.count, 0);
  assert.equal(total, publicTools.length);
  for (const t of publicTools) assert.ok(relatedTools(t).every((r) => r.status === 'implemented'));
});

test('implemented tools have the metadata the UI needs', () => {
  for (const t of publicTools) {
    assert.ok(t.description.length > 20, t.slug);
    assert.equal(t.processing, 'browser-local');
  }
});

test('backlog size (de-duplicated roadmap)', () => {
  // Reported, not asserted to an exact number: the brief's 210 include cross-category duplicates.
  console.log(`registry: ${registry.length} total, ${publicTools.length} implemented, ${registry.length - publicTools.length} planned`);
  assert.ok(registry.length >= 180);
});

test('search handles aliases, punctuation, accents and compact forms', () => {
  const idx = buildIndex(publicSearchItems);
  const top = (q: string) => search(idx, q)[0]?.slug;
  assert.equal(top('word counter'), 'word-counter');
  assert.equal(top('WORDCOUNTER'), 'word-counter');
  assert.equal(top('char count'), 'word-counter');
  assert.equal(top('json'), 'json-formatter');
  assert.equal(top('base 64'), 'base64-text');
  assert.equal(top('°C to °F'), 'temperature-converter');
  assert.equal(top('kg -> lbs'), 'mass-converter');
  assert.equal(top('Crème'), undefined);
  assert.equal(top('Pässword'), 'password-generator');
  assert.equal(top('hex to rgb'), 'color-converter');
  assert.deepEqual(search(idx, '   '), []);
  assert.equal(search(idx, 'zzzzqqq').length, 0);
  assert.equal(normalize('  Café—AU_lait! '), 'cafe au lait');
});

test('search index scales to 1,000 entries quickly', () => {
  const fake = Array.from({ length: 1000 }, (_, i) => ({ slug: `tool-${i}`, name: `Tool number ${i}`, description: 'A synthetic planned entry for scale testing.', categoryName: 'Test', aliases: [`alias ${i}`], tags: ['scale'] }));
  const idx = buildIndex(fake);
  const t0 = performance.now();
  for (let i = 0; i < 50; i++) search(idx, 'tool 99');
  const ms = (performance.now() - t0) / 50;
  assert.ok(ms < 20, `search took ${ms.toFixed(2)} ms`);
  assert.equal(search(idx, 'tool number 999')[0].slug, 'tool-999');
});
