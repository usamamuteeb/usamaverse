import Link from 'next/link';
import type { ToolMeta } from '@/lib/tools/types';
import { categoryName } from '@/lib/tools/public';
import { categoryEmoji } from '@/lib/ui-icons';

/** Compact tool row: icon, name, category and a two-line description. */
export function ToolCard({ tool }: { tool: Pick<ToolMeta, 'slug' | 'name' | 'description' | 'category'> }) {
  return (
    <li className="tool-card">
      <Link href={`/tools/${tool.slug}`} className="tool-card-link">
        <span className="tool-card-icon" aria-hidden="true">
          {categoryEmoji[tool.category]}
        </span>
        <span className="tool-card-body">
          <span className="tool-card-name">{tool.name}</span>
          <span className="tool-card-cat">{categoryName(tool.category)}</span>
          <span className="tool-card-desc">{tool.description}</span>
        </span>
      </Link>
    </li>
  );
}

export function ToolGrid({ tools }: { tools: Array<Pick<ToolMeta, 'slug' | 'name' | 'description' | 'category'>> }) {
  return (
    <ul className="tool-grid-list" role="list">
      {tools.map((t) => (
        <ToolCard key={t.slug} tool={t} />
      ))}
    </ul>
  );
}
