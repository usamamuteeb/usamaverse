import { categories, getCategory } from './categories';
import { implementedTools } from './registry.implemented';
import type { Category, CategorySlug, ToolMeta } from './types';

/** Only implemented tools are ever public: listed, searched, counted or routed. */
export const publicTools: ToolMeta[] = implementedTools.filter((t) => t.status === 'implemented');

const bySlug = new Map(publicTools.map((t) => [t.slug, t]));

export function getPublicTool(slug: string): ToolMeta | undefined {
  return bySlug.get(slug);
}

export function toolsInCategory(slug: CategorySlug): ToolMeta[] {
  return publicTools.filter((t) => t.category === slug);
}

/** Categories that currently have at least one implemented tool, with real counts. */
export function categoriesWithCounts(): Array<Category & { count: number }> {
  return categories
    .map((c) => ({ ...c, count: toolsInCategory(c.slug).length }))
    .filter((c) => c.count > 0);
}

export function relatedTools(tool: ToolMeta, limit = 4): ToolMeta[] {
  const explicit = tool.related.map((s) => bySlug.get(s)).filter((t): t is ToolMeta => Boolean(t));
  if (explicit.length >= limit) return explicit.slice(0, limit);
  const fill = publicTools.filter((t) => t.category === tool.category && t.slug !== tool.slug && !tool.related.includes(t.slug));
  return [...explicit, ...fill].slice(0, limit);
}

export function categoryName(slug: string): string {
  return getCategory(slug)?.name ?? slug;
}

/** Editorial picks (not popularity data). */
export const editorPicks = [
  'word-counter',
  'json-formatter',
  'password-generator',
  'image-compress',
  'organize-pdf',
  'compress-pdf',
  'case-converter',
  'color-converter',
  'date-difference',
  'regex-tester',
  'temperature-converter',
].filter((s) => bySlug.has(s));

/** Minimal fields for the client-side search index. */
export interface SearchItem {
  slug: string;
  name: string;
  description: string;
  category: CategorySlug;
  categoryName: string;
  aliases: string[];
  tags: string[];
}

export function toSearchItem(t: ToolMeta): SearchItem {
  return {
    slug: t.slug,
    name: t.name,
    description: t.description,
    category: t.category,
    categoryName: categoryName(t.category),
    aliases: t.aliases,
    tags: t.tags,
  };
}

export const publicSearchItems: SearchItem[] = publicTools.map(toSearchItem);
