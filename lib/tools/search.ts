/**
 * Instant local search over tool metadata. No network, no AI.
 * Every query token must match somewhere (AND). Matching is case-, accent-,
 * punctuation- and whitespace-insensitive, and "word counter" also matches
 * "wordcounter" / "word-counter".
 */
export interface Searchable {
  slug: string;
  name: string;
  description: string;
  categoryName: string;
  aliases: string[];
  tags: string[];
}

export function normalize(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

interface Part {
  words: string[];
  compact: string;
  weight: number;
}

export interface IndexedItem<T extends Searchable> {
  item: T;
  parts: Part[];
  nameNorm: string;
  nameCompact: string;
  aliasNorms: string[];
}

function part(text: string, weight: number): Part {
  const n = normalize(text);
  return { words: n ? n.split(' ') : [], compact: n.replace(/ /g, ''), weight };
}

export function buildIndex<T extends Searchable>(items: T[]): IndexedItem<T>[] {
  return items.map((item) => {
    const nameNorm = normalize(item.name);
    return {
      item,
      nameNorm,
      nameCompact: nameNorm.replace(/ /g, ''),
      aliasNorms: item.aliases.map(normalize),
      parts: [
        part(item.name, 10),
        part(item.slug, 8),
        ...item.aliases.map((a) => part(a, 8)),
        ...item.tags.map((t) => part(t, 5)),
        part(item.categoryName, 3),
        part(item.description, 2),
      ],
    };
  });
}

function tokenScore(token: string, parts: Part[]): number {
  let best = 0;
  for (const p of parts) {
    for (const w of p.words) {
      if (w === token) best = Math.max(best, 3 * p.weight);
      else if (w.startsWith(token)) best = Math.max(best, 2 * p.weight);
    }
    if (best < p.weight && token.length >= 3 && p.compact.includes(token)) best = Math.max(best, p.weight);
  }
  return best;
}

export function search<T extends Searchable>(index: IndexedItem<T>[], query: string, limit = Infinity): T[] {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const qCompact = q.replace(/ /g, '');
  const scored: Array<{ item: T; score: number }> = [];

  for (const entry of index) {
    let score = 0;
    let all = true;
    for (const t of tokens) {
      const s = tokenScore(t, entry.parts);
      if (s === 0) {
        all = false;
        break;
      }
      score += s;
    }
    // Whole-query compact match, e.g. "wordcounter" or "base 64".
    if (!all && qCompact.length >= 4 && entry.parts.some((p) => p.compact.includes(qCompact))) {
      all = true;
      score = 15;
    }
    if (!all) continue;
    // Small coverage bonus: more fields mentioning the query = more relevant.
    score += Math.min(10, entry.parts.filter((p) => tokens.some((t) => p.words.some((w) => w.startsWith(t)))).length);
    if (entry.nameNorm === q || entry.nameCompact === qCompact) score += 60;
    else if (entry.aliasNorms.includes(q)) score += 40;
    else if (entry.nameNorm.startsWith(q)) score += 25;
    scored.push({ item: entry.item, score });
  }

  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return scored.slice(0, limit).map((s) => s.item);
}
