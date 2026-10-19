import type { CategorySlug, ToolMeta, ToolPhase } from './types';

export interface ImplInput {
  slug: string;
  name: string;
  category: CategorySlug;
  description: string;
  aliases?: string[];
  tags?: string[];
  related?: string[];
  howTo?: string[];
  limits?: string[];
  phase?: ToolPhase;
}

export function impl(t: ImplInput): ToolMeta {
  return {
    id: t.slug,
    slug: t.slug,
    name: t.name,
    category: t.category,
    description: t.description,
    aliases: t.aliases ?? [],
    tags: t.tags ?? [],
    phase: t.phase ?? 'launch-basic',
    status: 'implemented',
    processing: 'browser-local',
    related: t.related ?? [],
    howTo: t.howTo,
    limits: t.limits,
  };
}
